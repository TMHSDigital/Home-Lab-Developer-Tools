import { nodeSetting } from "./ssh-api.js";

/**
 * Shared compose file selection for composeUp, composeDown, composePull and
 * composePs.
 *
 * Resolution order when no `stacks` are passed:
 * 1. HOMELAB_COMPOSE_FILES (comma-separated, used in the given order)
 * 2. Discovery in the compose directory on the node: compose.base.yml first,
 *    then the reference stack files in their historical order (monitoring,
 *    network, apps, security, storage, tools) when present, then any other
 *    compose.*.yml alphabetically. If none exist, the first of compose.yaml,
 *    compose.yml, docker-compose.yaml, docker-compose.yml is used.
 */

export const DEFAULT_COMPOSE_DIR = "/opt/homelab/docker";

/** Reference layout, in the order the files were always passed. */
export const KNOWN_STACK_FILES = [
  "compose.base.yml",
  "compose.monitoring.yml",
  "compose.network.yml",
  "compose.apps.yml",
  "compose.security.yml",
  "compose.storage.yml",
  "compose.tools.yml",
] as const;

const SINGLE_FILE_FALLBACKS = [
  "compose.yaml",
  "compose.yml",
  "docker-compose.yaml",
  "docker-compose.yml",
];

/** Allowed characters for file names configured via HOMELAB_COMPOSE_FILES. */
const COMPOSE_FILE_RE = /^[A-Za-z0-9._/-]+$/;

export function composeDir(node?: string): string {
  return nodeSetting(node, "HOMELAB_COMPOSE_DIR") || DEFAULT_COMPOSE_DIR;
}

/** Parse HOMELAB_COMPOSE_FILES; returns null when unset or empty. */
export function configuredComposeFiles(node?: string): string[] | null {
  const raw = nodeSetting(node, "HOMELAB_COMPOSE_FILES");
  if (!raw || !raw.trim()) return null;
  const files = raw
    .split(",")
    .map((f) => f.trim())
    .filter(Boolean);
  for (const f of files) {
    if (!COMPOSE_FILE_RE.test(f)) {
      throw new Error(
        `Invalid entry "${f}" in HOMELAB_COMPOSE_FILES. Use file names relative to ` +
          "HOMELAB_COMPOSE_DIR (letters, digits, '.', '_', '-', '/').",
      );
    }
  }
  return files.length > 0 ? files : null;
}

/**
 * Shell snippet that sets $files to the discovered "-f <file>" list, or exits
 * non-zero with a clear message when no compose file is found.
 */
function discoverySnippet(dir: string): string {
  const known = KNOWN_STACK_FILES.join(" ");
  const fallbacks = SINGLE_FILE_FALLBACKS.join(" ");
  return [
    `files=""`,
    `for f in ${known}; do if [ -f "$f" ]; then files="$files -f $f"; fi; done`,
    `for f in compose.*.yml; do case " ${known} " in *" $f "*) continue;; esac; ` +
      `if [ -f "$f" ]; then files="$files -f $f"; fi; done`,
    `if [ -z "$files" ]; then for f in ${fallbacks}; do ` +
      `if [ -f "$f" ]; then files="-f $f"; break; fi; done; fi`,
    `if [ -z "$files" ]; then echo "No compose files found in ${dir}. ` +
      `Set HOMELAB_COMPOSE_FILES or HOMELAB_COMPOSE_DIR." >&2; exit 1; fi`,
  ].join("; ");
}

/**
 * Build the full remote command: cd into the compose dir, pick the files,
 * and run `docker compose <files> <action>`.
 *
 * When `stacks` is given, compose.base.yml is passed first followed by each
 * requested file (unchanged behavior).
 */
export function buildComposeCommand(action: string, stacks?: string[], node?: string): string {
  const dir = composeDir(node);
  const cd = `cd ${dir} || exit 1`;

  if (stacks && stacks.length > 0) {
    const files = ["-f compose.base.yml", ...stacks.map((s) => `-f ${s}`)].join(" ");
    return `${cd}; docker compose ${files} ${action}`;
  }

  const configured = configuredComposeFiles(node);
  if (configured) {
    const files = configured.map((f) => `-f ${f}`).join(" ");
    return `${cd}; docker compose ${files} ${action}`;
  }

  return `${cd}; ${discoverySnippet(dir)}; docker compose $files ${action}`;
}
