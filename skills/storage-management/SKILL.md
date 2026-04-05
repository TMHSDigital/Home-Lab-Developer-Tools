---
name: storage-management
description: Manage Samba shares, Syncthing file sync, Docker volumes, and disk space on the Raspberry Pi.
---

# Storage Management

## Trigger

Use this skill when the user wants to:
- Create or modify Samba shares on the Pi
- Configure Syncthing for file synchronization between devices
- Manage Docker volumes (named volumes vs bind mounts)
- Monitor disk usage and free space on the Pi
- Clean up unused Docker images, volumes, or build cache
- Set up automated cleanup or log rotation strategies

## Required Inputs

- Target Pi hostname or IP
- For Samba: share name, path, and access permissions
- For Syncthing: folder path, device IDs, and sync direction
- For volume management: compose stack name or container name

## Workflow

1. **Check current disk usage** -- call `homelab_diskUsage` to get partition usage, largest directories, and free space. Identify if immediate cleanup is needed.
2. **Samba share management** (if requested):
   - Samba config is at `/etc/samba/smb.conf` on the Pi.
   - Add a new share block:
     ```ini
     [sharename]
     path = /srv/samba/sharename
     browseable = yes
     read only = no
     valid users = @smbgroup
     create mask = 0664
     directory mask = 0775
     ```
   - Create the directory and set ownership: `sudo mkdir -p /srv/samba/sharename && sudo chown -R nobody:smbgroup /srv/samba/sharename`
   - Add a Samba user: `sudo smbpasswd -a <username>`
   - Restart Samba: `sudo systemctl restart smbd`
   - Test from Windows: `net use Z: \\pi5\sharename /user:<username>`
3. **Syncthing configuration** (if requested):
   - Syncthing runs as a Docker container from `/opt/homelab/docker/syncthing/`.
   - Access the web UI via Nginx Proxy Manager or directly on port 8384.
   - Add folders through the UI or by editing the Syncthing config XML.
   - For ignore patterns, create a `.stignore` file in the synced folder:
     ```
     // Ignore temporary files
     *.tmp
     *.swp
     ~*
     .DS_Store
     Thumbs.db
     ```
   - Call `homelab_composePs` to verify the Syncthing container is healthy.
4. **Docker volume management**:
   - List volumes: `docker volume ls`
   - Inspect a volume: `docker volume inspect <name>`
   - Named volumes vs bind mounts:
     - Named volumes: managed by Docker, stored in `/var/lib/docker/volumes/`, easy to back up with `docker run --rm -v <vol>:/data -v /tmp:/backup busybox tar czf /backup/vol.tar.gz /data`.
     - Bind mounts: map host paths directly, used in compose stacks at `/opt/homelab/docker/<service>/`.
   - Prefer bind mounts for config that needs to be version-controlled or backed up with standard tools.
5. **Cleanup strategies**:
   - Remove unused Docker resources:
     ```bash
     docker system prune -af --volumes
     ```
   - Remove only dangling images: `docker image prune -f`
   - Clean apt cache: `sudo apt clean && sudo apt autoremove -y`
   - Rotate logs: configure `logrotate` for application logs or use Docker's `max-size` log option:
     ```yaml
     logging:
       driver: json-file
       options:
         max-size: "10m"
         max-file: "3"
     ```
   - Check journal size: `journalctl --disk-usage` and vacuum if large: `sudo journalctl --vacuum-size=100M`
6. **Set up monitoring** -- configure Prometheus alerts or Uptime Kuma checks for disk usage thresholds (warn at 80%, critical at 90%).
7. **Validate** -- call `homelab_diskUsage` again to confirm cleanup freed space. Call `homelab_serviceHealth` to verify services are unaffected.

## Key References

- Samba config: `/etc/samba/smb.conf` on the Pi
- Syncthing compose stack: `/opt/homelab/docker/syncthing/`
- Docker volumes documentation: named volumes, bind mounts, tmpfs
- Compose stack root: `/opt/homelab/docker/`
- Logrotate config: `/etc/logrotate.d/`

## Example Interaction

**User**: "My Pi is running low on disk space. Help me clean it up."

**Agent response**:

1. Call `homelab_diskUsage` to identify usage breakdown.
2. Identify largest consumers -- typically Docker images, logs, and apt cache.
3. Run cleanup:
   ```bash
   docker image prune -af
   docker volume prune -f
   sudo apt clean
   sudo journalctl --vacuum-size=100M
   ```
4. Add Docker log rotation to all compose stacks that lack it.
5. Call `homelab_diskUsage` to confirm free space increased.
6. Suggest setting up a cron job for periodic cleanup:
   ```bash
   echo "0 3 * * 0 docker image prune -af >> /var/log/docker-cleanup.log 2>&1" | sudo tee /etc/cron.d/docker-cleanup
   ```

## MCP Usage

| Tool | Purpose |
|------|---------|
| `homelab_diskUsage` | Check partition usage, identify space hogs |
| `homelab_piStatus` | Overall system state including storage |
| `homelab_serviceHealth` | Verify services after volume or share changes |
| `homelab_composePs` | Check Syncthing and other container states |
| `homelab_composeUp` | Redeploy stacks after volume config changes |
| `homelab_composeDown` | Stop stacks before major volume operations |
| `homelab_serviceLogs` | Debug Samba or Syncthing issues |
| `homelab_serviceRestart` | Restart smbd after config changes |
| `homelab_backupStatus` | Check if backups are consuming excessive space |

## Common Pitfalls

- **docker system prune deletes too much** -- the `-a` flag removes all unused images, not just dangling ones. Omit `-a` if you want to keep images for quick container recreation.
- **Samba permissions** -- Linux file permissions and Samba share permissions are both enforced. A user needs both to access files. Use `force user` and `force group` in smb.conf for simpler setups.
- **Bind mount ownership** -- containers running as non-root may not be able to write to bind-mounted directories. Match the container UID/GID to the host directory ownership.
- **SD card wear** -- Raspberry Pi SD cards have limited write cycles. Minimize writes by using log rotation, tmpfs for temporary data, and external storage for heavy write workloads.
- **Syncthing conflicts** -- simultaneous edits on multiple devices create `.sync-conflict` files. Set up folder types (send-only, receive-only) to avoid bidirectional conflicts.
- **Volume data loss** -- `docker volume prune` permanently deletes unused volumes. Always check `homelab_backupStatus` before pruning.

## See Also

- `backup-recovery` -- backup strategies for volumes and share data
- `docker-compose-stacks` -- volume definitions in compose files
- `troubleshooting` -- debug disk-full errors and container storage issues
- `pi-system-management` -- system-level disk and mount management
