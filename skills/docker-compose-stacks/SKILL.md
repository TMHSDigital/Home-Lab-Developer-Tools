---
name: docker-compose-stacks
description: Manage multi-file Docker Compose deployments on a Raspberry Pi home lab server.
tools:
  - homelab_composeUp
  - homelab_composeDown
  - homelab_composePull
  - homelab_composePs
---

# Docker Compose Stacks

Manage the multi-file Docker Compose deployment across seven stack directories on a
Raspberry Pi 5 home lab. Covers selective deployment, service updates, image pulls,
troubleshooting, and understanding the split-stack architecture.

## Trigger

- User asks to start, stop, update, or restart a Docker service
- User mentions a specific service name (Grafana, AdGuard, Portainer, etc.)
- User wants to pull new images or redeploy a stack
- User asks about compose file structure or stack organization
- User says "deploy", "compose up", "update containers", or "pull images"
- User reports a service is down or not responding

## Required Inputs

- SSH connectivity to the Raspberry Pi (validated via `homelab_sshTest`)
- Knowledge of which stack a service belongs to

Optional:
- Specific service name(s) to target within a stack
- Whether to force-recreate containers on update

## Workflow

1. **Verify connectivity** -- call `homelab_sshTest`.
2. **Identify the target stack** -- map the user's request to one of the seven
   stack directories under `/opt/homelab/docker/`:
   - `base/` -- Portainer, Homepage, Watchtower
   - `monitoring/` -- Prometheus, Grafana, node_exporter, Uptime Kuma, Alertmanager
   - `network/` -- AdGuard Home, Nginx Proxy Manager, Tailscale
   - `apps/` -- Vaultwarden, Stirling PDF, Code Server
   - `security/` -- Crowdsec, fail2ban sidecar configs
   - `storage/` -- Syncthing, Samba configs
   - `tools/` -- Ntfy, Speedtest Tracker
3. **Check current state** -- call `homelab_composePs` with the stack path to see
   running containers, health status, and port mappings.
4. **Execute the requested action:**
   - **Start/deploy:** call `homelab_composeUp` with the stack path
   - **Stop:** call `homelab_composeDown` with the stack path
   - **Update:** call `homelab_composePull` then `homelab_composeUp` with
     `--force-recreate` to apply new images
   - **Restart a single service:** call `homelab_serviceRestart` with the
     service name
5. **Verify the result** -- call `homelab_composePs` again to confirm the desired
   state. Optionally call `homelab_serviceHealth` for health-checked services.
6. **Report** -- summarize what changed, any containers that failed to start, and
   next steps if something went wrong.

## Key References

Stack directory layout:
```
/opt/homelab/docker/
  base/docker-compose.yml        # Portainer, Homepage, Watchtower
  monitoring/docker-compose.yml  # Prometheus, Grafana, node_exporter, Uptime Kuma
  network/docker-compose.yml     # AdGuard Home, Nginx Proxy Manager
  apps/docker-compose.yml        # Vaultwarden, Stirling PDF, Code Server
  security/docker-compose.yml    # Crowdsec, fail2ban
  storage/docker-compose.yml     # Syncthing
  tools/docker-compose.yml       # Ntfy, Speedtest Tracker
```

Service-to-stack mapping (quick reference):
- Prometheus, Grafana, Uptime Kuma -- `monitoring`
- AdGuard Home, Nginx Proxy Manager -- `network`
- Vaultwarden, Code Server, Stirling PDF -- `apps`
- Portainer, Homepage -- `base`
- Ntfy, Speedtest Tracker -- `tools`
- Syncthing -- `storage`

## Example Interaction

**User:** "Update Grafana to the latest version"

**Assistant actions:**
1. Call `homelab_sshTest`
2. Call `homelab_composePull` with stack path `/opt/homelab/docker/monitoring`
3. Call `homelab_composeUp` with stack path `/opt/homelab/docker/monitoring`
4. Call `homelab_composePs` with stack path `/opt/homelab/docker/monitoring`

**Response:**
> Pulled latest images for the monitoring stack. Grafana was updated from
> 11.3.0 to 11.4.1. All 4 containers in the monitoring stack are running
> and healthy.

**User:** "Bring down the tools stack"

**Assistant actions:**
1. Call `homelab_composeDown` with stack path `/opt/homelab/docker/tools`
2. Call `homelab_composePs` to confirm

**Response:**
> Tools stack stopped. Ntfy and Speedtest Tracker containers removed.
> Other stacks are unaffected.

## MCP Usage

| Tool                    | Purpose                                          |
|--------------------------|--------------------------------------------------|
| `homelab_sshTest`        | Validate SSH before compose operations           |
| `homelab_composeUp`      | Start or recreate containers in a stack          |
| `homelab_composeDown`    | Stop and remove containers in a stack            |
| `homelab_composePull`    | Pull latest images for a stack                   |
| `homelab_composePs`      | List container status for a stack                |
| `homelab_serviceRestart` | Restart an individual service by name            |
| `homelab_serviceHealth`  | Check health endpoint of a specific service      |
| `homelab_serviceLogs`    | Retrieve recent logs for a service               |

## Common Pitfalls

- **Pulling all stacks at once** -- avoid calling `homelab_composePull` on every
  stack simultaneously. The Pi has limited bandwidth and disk I/O. Update one
  stack at a time.
- **Forgetting dependent stacks** -- the `monitoring` stack depends on `network`
  for DNS resolution and proxy. Do not take down `network` without considering
  the impact on monitoring dashboards.
- **Orphan containers** -- if a service is removed from a compose file but the
  container still exists, use `homelab_composeUp` with the `--remove-orphans` flag.
- **Port conflicts** -- bringing up a stack that binds ports already in use by
  another stack will fail silently in some cases. Check `homelab_composePs` across
  all stacks if a container exits immediately.
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
