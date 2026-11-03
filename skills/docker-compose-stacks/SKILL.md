---
name: docker-compose-stacks
description: Manage multi-file Docker Compose deployments on a Raspberry Pi home lab server.
tools:
  - homelab_composeUp
  - homelab_composeDown
  - homelab_composePull
  - homelab_composePs
standards-version: 1.10.0
---

# Docker Compose Stacks

Manage a multi-file Docker Compose deployment on a Raspberry Pi 5 home lab. All
stack files live in one directory (`HOMELAB_COMPOSE_DIR`, default
`/opt/homelab/docker`) as `compose.<stack>.yml` files that are combined with `-f`.
Covers selective deployment, service updates, image pulls, troubleshooting, and
understanding the split-stack layout.

## Trigger

- User asks to start, stop, update, or restart a Docker service
- User mentions a specific service name (Grafana, AdGuard, Portainer, etc.)
- User wants to pull new images or redeploy a stack
- User asks about compose file structure or stack organization
- User says "deploy", "compose up", "update containers", or "pull images"
- User reports a service is down or not responding

## Required Inputs

- SSH connectivity to the Raspberry Pi (validated via `homelab_sshTest`)
- Knowledge of which compose file a service belongs to

Optional:
- Specific stack file(s) to target, passed as `stacks`

## Workflow

1. **Verify connectivity** -- call `homelab_sshTest`.
2. **Identify the target stack file** -- map the user's request to one of the
   compose files in the compose directory (reference layout below). Tools take
   file names, not directories: `stacks: ["compose.monitoring.yml"]`.
   `compose.base.yml` is always included automatically when `stacks` is given.
3. **Check current state** -- call `homelab_composePs`. It takes no stack
   parameter and always lists containers across all compose files.
4. **Execute the requested action:**
   - **Start/deploy:** `homelab_composeUp` with `stacks` and `confirm: true`
     (it always runs `up -d --remove-orphans`)
   - **Stop:** `homelab_composeDown` with `stacks` and `confirm: true`
     (`removeVolumes: true` also deletes named volumes -- only with explicit user approval)
   - **Update:** `homelab_composePull` with `stacks`, then `homelab_composeUp`
     with the same `stacks` and `confirm: true`. Compose recreates containers
     whose image changed; there is no force-recreate option.
   - **Restart a single container:** `homelab_serviceRestart` with the container
     name and `confirm: true`
5. **Verify the result** -- call `homelab_composePs` again to confirm the desired
   state. Optionally call `homelab_serviceHealth` for health-checked services.
6. **Report** -- summarize what changed, any containers that failed to start, and
   next steps if something went wrong.

## Key References

Reference layout (all files in `HOMELAB_COMPOSE_DIR`, default `/opt/homelab/docker/`):
```
/opt/homelab/docker/
  compose.base.yml        # Portainer, Homepage
  compose.monitoring.yml  # Prometheus, Grafana, node_exporter, Uptime Kuma, Alertmanager
  compose.network.yml     # AdGuard Home, Nginx Proxy Manager
  compose.apps.yml        # Vaultwarden, Stirling PDF, Code Server
  compose.security.yml    # Security tooling
  compose.storage.yml     # Syncthing
  compose.tools.yml       # Ntfy, Speedtest Tracker
```

When `stacks` is omitted, the tools use `HOMELAB_COMPOSE_FILES` if set; otherwise
they discover `compose.base.yml` and every `compose.*.yml` in the directory,
falling back to a single `compose.yaml` or `docker-compose.yml`.

Service-to-file mapping (quick reference):
- Prometheus, Grafana, Uptime Kuma -- `compose.monitoring.yml`
- AdGuard Home, Nginx Proxy Manager -- `compose.network.yml`
- Vaultwarden, Code Server, Stirling PDF -- `compose.apps.yml`
- Portainer, Homepage -- `compose.base.yml`
- Ntfy, Speedtest Tracker -- `compose.tools.yml`
- Syncthing -- `compose.storage.yml`

## Example Interaction

**User:** "Update Grafana to the latest version"

**Assistant actions:**
1. Call `homelab_sshTest`
2. Call `homelab_composePull` with `stacks: ["compose.monitoring.yml"]`
3. Call `homelab_composeUp` with `stacks: ["compose.monitoring.yml"]` and `confirm: true`
4. Call `homelab_composePs`

**Response:**
> Pulled latest images for the monitoring stack. Grafana was updated from
> 11.3.0 to 11.4.1. All 4 containers in the monitoring stack are running
> and healthy.

**User:** "Bring down the tools stack"

**Assistant actions:**
1. Call `homelab_composeDown` with `stacks: ["compose.tools.yml"]` and `confirm: true`
2. Call `homelab_composePs` to confirm

**Response:**
> Tools stack stopped. Ntfy and Speedtest Tracker containers removed.
> Other stacks are unaffected.

## MCP Usage

| Tool                    | Purpose                                          |
|--------------------------|--------------------------------------------------|
| `homelab_sshTest`        | Validate SSH before compose operations           |
| `homelab_composeUp`      | Start or recreate containers (`stacks`, `confirm`) |
| `homelab_composeDown`    | Stop and remove containers (`stacks`, `removeVolumes`, `confirm`) |
| `homelab_composePull`    | Pull latest images (`stacks`)                    |
| `homelab_composePs`      | List container status across all compose files   |
| `homelab_serviceRestart` | Restart an individual container by name          |
| `homelab_serviceHealth`  | Check health status of containers                |
| `homelab_serviceLogs`    | Retrieve recent logs for a container             |

## Common Pitfalls

- **Confirm gate** -- `homelab_composeUp`, `homelab_composeDown`, and `homelab_serviceRestart` require `confirm=true` to proceed. Calls without it return a cancellation message and do nothing.
- **Directories instead of files** -- `stacks` takes compose file names such as
  `compose.monitoring.yml`, not paths like `/opt/homelab/docker/monitoring`.
- **Pulling all stacks at once** -- omitting `stacks` pulls images for every
  compose file. The Pi has limited bandwidth and disk I/O, so prefer updating one
  stack at a time.
- **Forgetting dependent stacks** -- the monitoring stack depends on the network
  stack for DNS resolution and proxy. Do not take down `compose.network.yml`
  without considering the impact on monitoring dashboards.
- **Orphan containers** -- `homelab_composeUp` always passes `--remove-orphans`,
  so containers removed from the selected compose files are cleaned up.
- **Port conflicts** -- bringing up a stack that binds ports already in use by
  another stack will fail silently in some cases. Check `homelab_composePs` if a
  container exits immediately.
- **ARM image compatibility** -- not all Docker images support `linux/arm64`. If a
  pull fails or a container crashes on startup, check that the image provides an
  ARM64 variant.
- **Disk space before pulling** -- call `homelab_diskUsage` before large pull
  operations. Docker images accumulate and the Pi's SD card or SSD can fill up.

## See Also

- `pi-system-management` -- hardware health before and after deployments
- `service-monitoring` -- verifying services are healthy post-deployment
- `network-configuration` -- proxy and DNS changes needed for new services
- `backup-recovery` -- backing up volumes before destructive compose operations
