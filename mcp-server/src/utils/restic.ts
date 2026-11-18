import { errorResponse, nodeSetting } from "./ssh-api.js";
import { CommandFailedError } from "./errors.js";
import { backupRepo } from "./config.js";

const MISSING_REPO = /does not exist|unable to open config file|Is there a repository at the following location/i;
const PASSWORD_PROBLEM = /empty password|password is not allowed|Resolving password failed|reading repository password|wrong password/i;

/** Env file sourced (when present) before running restic, as the backup script does. */
export const DEFAULT_RESTIC_ENV_FILE = "/etc/restic-env";

const PATH_RE = /^\/[A-Za-z0-9._\/-]+$/;

function quote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function pathSetting(node: string | undefined, key: string, fallback?: string): string | null {
  const raw = nodeSetting(node, key);
  const value = raw === undefined ? fallback : raw.trim();
  if (!value || value === "none") return null;
  if (!PATH_RE.test(value)) {
    throw new Error(`${key} must be an absolute path on the node (letters, digits, '.', '_', '-', '/').`);
  }
  return value;
}

/**
 * Build `sudo restic -r <repo> <args>` for a node with the repository
 * credentials restic needs. sudo resets the environment, so:
 * - HOMELAB_RESTIC_ENV_FILE (default /etc/restic-env, "none" to disable) is
 *   sourced as root when it exists, providing RESTIC_PASSWORD and backend
 *   credentials the same way the backup script gets them.
 * - HOMELAB_RESTIC_PASSWORD_FILE, when set, is passed as --password-file.
 * `args` is appended as-is and must already be shell-quoted.
 */
export function resticCommand(args: string, node?: string): string {
  const repo = backupRepo(node);
  const envFile = pathSetting(node, "HOMELAB_RESTIC_ENV_FILE", DEFAULT_RESTIC_ENV_FILE);
  const passwordFile = pathSetting(node, "HOMELAB_RESTIC_PASSWORD_FILE");
  const resticArgs = `-r ${quote(repo)}${passwordFile ? ` --password-file ${quote(passwordFile)}` : ""} ${args}`;
  if (!envFile) return `sudo restic ${resticArgs}`;
  // The env file path is passed as $0 so restic's arguments need no re-quoting.
  return `sudo sh -c 'if [ -f "$0" ]; then set -a; . "$0"; set +a; fi; exec restic "$@"' ${quote(envFile)} ${resticArgs}`;
}

/**
 * Map restic failures to an error response. A missing repository gets a
 * pointer to HOMELAB_BACKUP_REPO; every other failure (wrong password,
 * locked repo, sudo refusal) keeps restic's own message.
 */
export function resticErrorResponse(error: unknown, repo: string) {
  if (error instanceof CommandFailedError && MISSING_REPO.test(error.message)) {
    return {
      content: [{
        type: "text" as const,
        text: `No restic repository found at ${repo}. Check HOMELAB_BACKUP_REPO.\n\n${error.message}`,
      }],
      isError: true as const,
    };
  }
  if (error instanceof CommandFailedError && PASSWORD_PROBLEM.test(error.message)) {
    return {
      content: [{
        type: "text" as const,
        text:
          `restic could not open ${repo} with a password. Put RESTIC_PASSWORD in ` +
          `HOMELAB_RESTIC_ENV_FILE (default ${DEFAULT_RESTIC_ENV_FILE}) or point ` +
          `HOMELAB_RESTIC_PASSWORD_FILE at a password file on the node.\n\n${error.message}`,
      }],
      isError: true as const,
    };
  }
  return errorResponse(error);
}
