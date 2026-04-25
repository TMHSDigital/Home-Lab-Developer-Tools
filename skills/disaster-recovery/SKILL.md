---
name: disaster-recovery
description: Full Pi disaster recovery -- backup verification, restore workflows, SD card imaging, and migration checklists
tools:
  - homelab_backupList
  - homelab_backupRestore
  - homelab_backupDiff
  - homelab_volumeBackup
  - homelab_backupStatus
  - homelab_backupRun
standards-version: 1.7.0
---

# Disaster Recovery

Guide the user through full Raspberry Pi disaster recovery, including backup verification, snapshot restore, Docker volume recovery, SD card imaging, and multi-node migration.

## Trigger

- User asks how to restore their Pi after a failure
- User wants to verify backups are complete and recent
- User needs to migrate to new hardware (new Pi, new SD card)
- User wants to recover a specific Docker volume or service
- User asks about backup strategy, retention, or coverage
- User mentions "restore", "disaster recovery", "migration", or "SD card imaging"
- User asks what changed between backups

## Required Inputs

- SSH connectivity to the Raspberry Pi (validated via `homelab_sshTest`)
- Restic installed on the Pi (`sudo apt install restic`)
- Backup repository accessible at `HOMELAB_BACKUP_REPO` (default `/mnt/backup/restic`)

Optional:
- Snapshot ID for targeted restore or diff operations
- Docker volume name for volume-specific backup/restore
- Target path for restore destination

## Workflow

### Backup Verification

1. Run `homelab_backupStatus` to check the latest restic snapshots and confirm the backup timer is running.
2. Run `homelab_backupList` to get the full snapshot inventory. Filter by `--tag docker-volume` to see volume-specific snapshots.
3. Use `homelab_backupDiff` between the two most recent snapshots to verify incremental changes look reasonable (no unexpected large deletions).

### Full Restore

Prerequisites:
- Fresh Raspberry Pi OS installed on the target SD card
- SSH access configured
- restic installed (`sudo apt install restic`)
- Backup repository accessible (mounted or available via SFTP/S3)

Steps:

1. Verify the backup repo is reachable:

```bash
sudo restic -r /mnt/backup/restic snapshots --latest 1
```

2. Restore the full system backup to a staging directory using `homelab_backupRestore` with `snapshot: "latest"`, `target: "/tmp/restore"`, `confirm: true`.

3. Copy restored files to their final locations:

```bash
sudo rsync -avh /tmp/restore/opt/homelab/ /opt/homelab/
sudo rsync -avh /tmp/restore/etc/ /etc/ --exclude=fstab --exclude=hostname
```

4. Restore Docker volumes individually using `homelab_backupRestore` with `include: "/var/lib/docker/volumes/VOLUME_NAME"`.

5. Restart Docker and bring stacks up:

```bash
sudo systemctl restart docker
cd /opt/homelab/docker && docker compose -f compose.base.yml up -d
```

6. Verify services with `homelab_serviceHealth`.

### Docker Volume Recovery

To restore a single Docker volume:

1. Stop the container that owns the volume.
2. Run `homelab_backupRestore` with:
   - `snapshot`: the snapshot ID containing the volume data (use `homelab_backupList` with `tag: "docker-volume"` to find it)
   - `target`: `/` (restore to original paths)
   - `include`: `/var/lib/docker/volumes/VOLUME_NAME/_data`
   - `confirm`: true
3. Restart the container.

### SD Card Imaging

For bare-metal backup (not restic), guide the user through:

```bash
# On a separate machine, create an image of the SD card
sudo dd if=/dev/sdX of=pi-backup.img bs=4M status=progress
# Compress it
xz -9 pi-backup.img
```

To restore:

```bash
xz -d pi-backup.img.xz
sudo dd if=pi-backup.img of=/dev/sdX bs=4M status=progress
```

### Migration Checklist

When moving to new hardware:

- [ ] Create a fresh restic backup: `homelab_backupRun` with `confirm: true`
- [ ] Verify the backup: `homelab_backupList` (confirm latest snapshot timestamp)
- [ ] Image the current SD card as a fallback
- [ ] Install Raspberry Pi OS on the new hardware
- [ ] Mount the backup repository on the new Pi
- [ ] Restore from backup (see Full Restore section above)
- [ ] Update `/etc/fstab` if disk layout changed
- [ ] Update hostname and network config if needed
- [ ] Update Tailscale registration if IP changed
- [ ] Test all services: `homelab_serviceHealth`
- [ ] Update DNS records if the Pi IP changed (AdGuard, NPM)

## Example Interaction

**User:** My Pi's SD card died. I have restic backups on an external drive. How do I get everything back?

**Assistant:**

1. First, let me check what backups are available.

   *Calls `homelab_backupList`*

   You have 42 snapshots. The latest is from 2 hours ago -- that's good.

2. Let me check what changed in the last two snapshots.

   *Calls `homelab_backupDiff` with the two most recent snapshot IDs*

   Only 12 config files changed -- normal daily delta.

3. Here's the plan:
   - Install fresh Raspberry Pi OS on the new SD card
   - Mount your backup drive at `/mnt/backup`
   - Restore system files: `homelab_backupRestore` with `snapshot: "latest"`, `target: "/tmp/restore"`, `confirm: true`
   - Copy `/opt/homelab/` back into place
   - Restore each Docker volume
   - Bring the compose stacks back up

   Want me to walk through each step?

### Backup Strategy Recommendations

- Run `homelab_backupRun` daily via systemd timer (already configured)
- Keep at least 7 daily, 4 weekly, and 6 monthly snapshots
- Back up Docker volumes separately with `homelab_volumeBackup` before major upgrades
- Store at least one copy off-site (USB drive, S3, or remote restic repo)
- Test restore quarterly by restoring to a temp directory and verifying file integrity
