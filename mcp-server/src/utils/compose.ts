import { nodeSetting } from "./ssh-api.js";

/**
 * Shared compose file selection for composeUp, composeDown, composePull and
 * composePs.
 *
 * Resolution order for the project's file list:
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
 * Build the full remote command for the whole project: cd into the compose
 * dir, pick the files, and run `docker compose <files> <action>`. For a
 * subset of stack files use buildStackCommand.
 */
export function buildComposeCommand(action: string, node?: string): string {
  const dir = composeDir(node);
  const cd = `cd ${dir} || exit 1`;

  const configured = configuredComposeFiles(node);
  if (configured) {
    const files = configured.map((f) => `-f ${f}`).join(" ");
    return `${cd}; docker compose ${files} ${action}`;
  }

  return `${cd}; ${discoverySnippet(dir)}; docker compose $files ${action}`;
}

/**
 * Build a command that acts on the services of the given stack files only.
 *
 * All stack files in the compose directory share one Compose project, so
 * running `up --remove-orphans` or `down` with a subset of files would treat
 * every other stack's containers as orphans (or take base services down).
 * Instead, the full project file list is passed so the project stays
 * complete, and each action targets only the services the stack files
 * define. Services from compose.base.yml are excluded unless it is one of
 * the requested stacks. Each action is run as `docker compose $files <action>`
 * and may use `$services`.
 */
export function buildStackCommand(actions: string[], stacks: string[], node?: string): string {
  for (const s of stacks) {
    if (!COMPOSE_FILE_RE.test(s)) {
      throw new Error(
        `Invalid stack file "${s}". Use file names relative to HOMELAB_COMPOSE_DIR ` +
          "(letters, digits, '.', '_', '-', '/').",
      );
    }
  }
  const dir = composeDir(node);
  const configured = configuredComposeFiles(node);
  const filesSnippet = configured
    ? `files="${configured.map((f) => ` -f ${f}`).join("")}"`
    : discoverySnippet(dir);
  const stackFlags = stacks.map((s) => `-f ${s}`).join(" ");
  const includeBase = stacks.includes("compose.base.yml");

  return [
    `cd ${dir} || exit 1`,
    filesSnippet,
    `for s in ${stacks.join(" ")}; do case "$files " in *" -f $s "*) ;; *) files="$files -f $s";; esac; done`,
    includeBase
      ? `services=$(docker compose ${stackFlags} config --services) || exit 1`
      : `if [ -f compose.base.yml ]; then ` +
        `services=$(docker compose -f compose.base.yml ${stackFlags} config --services) || exit 1; ` +
        `base=$(docker compose -f compose.base.yml config --services) || exit 1; ` +
        `services=$(printf '%s\\n' "$services" | grep -vxF "$base"); ` +
        `else services=$(docker compose ${stackFlags} config --services) || exit 1; fi`,
    `if [ -z "$services" ]; then echo "No services found in ${stacks.join(", ")}." >&2; exit 1; fi`,
    actions.map((a) => `docker compose $files ${a}`).join(" && "),
  ].join("; ");
}
