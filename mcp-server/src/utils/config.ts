import { nodeSetting } from "./ssh-api.js";

export const DEFAULT_BACKUP_REPO = "/mnt/backup/restic";

/** Restic repository for a node (HOMELAB_BACKUP_REPO, per-node overridable). */
export function backupRepo(node?: string): string {
  return nodeSetting(node, "HOMELAB_BACKUP_REPO") || DEFAULT_BACKUP_REPO;
}
