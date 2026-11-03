import { errorResponse } from "./ssh-api.js";
import { CommandFailedError } from "./errors.js";

const MISSING_REPO = /does not exist|unable to open config file|Is there a repository at the following location/i;

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
  return errorResponse(error);
}
