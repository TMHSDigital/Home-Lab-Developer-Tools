---
name: backup-recovery
description: Configure and manage restic backups including scheduling, verification, and disaster recovery.
tools:
  - homelab_backupStatus
  - homelab_backupRun
  - homelab_backupList
  - homelab_backupDiff
---

# Backup and Recovery

Configure and operate restic-based backups for a Raspberry Pi 5 home lab. Covers
repository initialization, backup scripts, systemd timer scheduling, snapshot
verification, restore procedures, and retention policy management.

## Trigger

- User asks about backups, snapshots, or restore procedures
- User wants to set up or verify a backup schedule
- User asks "is my data backed up?" or "when was the last backup?"
- User mentions "restic", "snapshot", "retention", or "disaster recovery"
- User wants to restore a file, volume, or entire service from backup
- User asks about backup storage, repository health, or integrity checks

## Required Inputs

- SSH connectivity to the Raspberry Pi (validated via `homelab_sshTest`)
- Restic repository location (local path, SFTP, S3, or B2 bucket)
- Restic repository password (stored in MCP config or environment variable)

Optional:
- Specific paths or volumes to back up
- Retention policy parameters (keep-daily, keep-weekly, keep-monthly)
- Restore target path or service name

## Workflow

1. **Verify connectivity** -- call `homelab_sshTest`.
2. **Check backup status** -- call `homelab_backupStatus` to retrieve the last
   backup timestamp, snapshot count, repository size, and any errors from the
   most recent run.
3. **Branch based on task:**

   **Setting up a new backup:**
   - Initialize the restic repository: `restic init --repo <path>`
   - Create a backup script that includes:
     - Docker volume paths: `/var/lib/docker/volumes/`
     - Compose configs: `/opt/homelab/docker/`
     - Service data directories (AdGuard config, Grafana dashboards, etc.)
     - System configs: `/etc/` (selective)
   - Exclude: Docker image layers, cache dirs, temp files, log archives
   - Set up a systemd timer for scheduled runs (e.g., daily at 03:00)
   - Configure retention: `--keep-daily 7 --keep-weekly 4 --keep-monthly 6`

   **Verifying backups:**
   - Call `homelab_backupStatus` to check last run
   - List snapshots with restic to confirm recent entries
   - Run `restic check` to verify repository integrity
   - Optionally run `restic diff` between latest snapshots to review changes

   **Running a manual backup:**
   - Call `homelab_backupRun` to trigger an immediate backup
   - Monitor progress via `homelab_serviceLogs` on the backup service
   - Verify the new snapshot appears in `homelab_backupStatus`

   **Restoring data:**
   - List available snapshots and identify the target snapshot ID
   - Stop the affected service via `homelab_serviceRestart` or
     `homelab_composeDown` to avoid file conflicts
   - Restore with `restic restore <snapshot-id> --target <path>`
   - Restart the service and verify functionality
   - Call `homelab_serviceHealth` to confirm the service is healthy

4. **Report** -- summarize backup status, any issues found, and recommendations.

## Key References

Backup scope -- critical paths to include:
```
/opt/homelab/docker/          # All compose files and configs
/var/lib/docker/volumes/      # Persistent container data
  vaultwarden_data/           # Password vault (critical)
  grafana_data/               # Dashboards and settings
  adguard_data/               # DNS config and query logs
  npm_data/                   # Proxy hosts and SSL certs
  uptime-kuma_data/           # Monitor configurations
  syncthing_data/             # Sync state (not synced files)
  prometheus_data/            # Metrics TSDB
```

Backup exclusions:
- `/var/lib/docker/overlay2/` -- image layers, reproducible from registry
- `*.log`, `*.tmp`, `cache/` directories
- Prometheus WAL if TSDB is being snapshotted separately

Systemd timer setup:
- Timer unit: `/etc/systemd/system/restic-backup.timer`
- Service unit: `/etc/systemd/system/restic-backup.service`
- Environment file: `/etc/restic-env` (repo URL, password)

Retention policy defaults:
- 7 daily, 4 weekly, 6 monthly, 2 yearly snapshots
- Run `restic forget --prune` after applying retention changes

## Example Interaction

**User:** "When was the last backup?"

**Assistant actions:**
1. Call `homelab_sshTest`
2. Call `homelab_backupStatus`

**Response:**
> Last backup completed 6 hours ago at 03:02 AM. 47 snapshots in the
> repository, 12.3 GB total. No errors on last run. Next scheduled
> backup at 03:00 AM tomorrow.

**User:** "Restore Vaultwarden from yesterday's backup"

**Assistant actions:**
1. Call `homelab_backupStatus` to list recent snapshots
2. Identify yesterday's snapshot ID
3. Call `homelab_composeDown` for the security stack to stop Vaultwarden
4. Guide user through the restore command
5. Call `homelab_composeUp` for the security stack
6. Call `homelab_serviceHealth` for Vaultwarden

**Response:**
> Vaultwarden stopped. Restored volume data from snapshot `a3f7c21b`
> (yesterday 03:01 AM). Vaultwarden restarted and is healthy. Verify
> your vault entries are correct.

## MCP Usage

| Tool                    | Purpose                                         |
|--------------------------|------------------------------------------------|
| `homelab_sshTest`        | Validate SSH connectivity                      |
| `homelab_backupStatus`   | Get last backup time, snapshot count, errors    |
| `homelab_backupRun`      | Trigger an immediate backup                    |
| `homelab_serviceLogs`    | Monitor backup job progress and errors         |
| `homelab_composeDown`    | Stop services before restore operations        |
| `homelab_composeUp`      | Restart services after restore                 |
| `homelab_serviceHealth`  | Verify service health after restore            |
| `homelab_diskUsage`      | Check available space for backup storage       |

## Common Pitfalls

- **Backing up running databases** -- SQLite databases (NPM, Uptime Kuma) can
  corrupt if copied while being written to. Use SQLite's `.backup` command or
  stop the container briefly before snapshotting.
- **Repository lock stale** -- if a backup was interrupted, restic may leave a
  stale lock. Use `restic unlock` to clear it, but only after confirming no
  backup process is actually running.
- **Forgetting to prune** -- `restic forget` marks snapshots for removal but does
  not reclaim space. Always run with `--prune` or run `restic prune` afterward.
- **Vaultwarden is critical** -- the Vaultwarden volume contains encrypted
  password data. Treat it as the highest-priority backup target. Verify restores
  periodically.
- **Disk space on the Pi** -- if backing up to a local disk on the Pi, monitor
  free space with `homelab_diskUsage`. A full disk will crash Docker services.
  Prefer remote backup destinations (NAS, S3, B2).
- **Restore overwrites current data** -- always confirm with the user before
  restoring. A restore replaces current files. Consider restoring to a temporary
  directory first for comparison.
- **Environment variables for restic** -- the backup script needs `RESTIC_REPOSITORY`
  and `RESTIC_PASSWORD` (or `RESTIC_PASSWORD_FILE`). If these are missing, the
  backup silently fails. Check the environment file.
- **Testing restores** -- a backup you have never restored from is not a backup.
  Schedule periodic restore tests to a temporary directory.

## See Also

- `pi-system-management` -- checking disk space before backups
- `docker-compose-stacks` -- stopping/starting services around restores
- `service-monitoring` -- alerting on backup failures via Prometheus
- `network-configuration` -- network access to remote backup repositories
