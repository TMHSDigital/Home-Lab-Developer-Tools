# Home Lab MCP Server

MCP (Model Context Protocol) server for home lab operations. Connects to a Raspberry Pi (or multiple nodes) via SSH and provides 55 tools for system management, Docker Compose stacks, service monitoring, networking, backups, disaster recovery, security auditing, log analysis, notifications, OS management, certificate lifecycle, multi-node management, and diagnostics. Every tool except `homelab_nodeList` takes a `node` parameter to target a node from `HOMELAB_NODES` (optional, except for `homelab_nodeExec` and `homelab_nodeStatus` where it is required). Read-only status tools such as `homelab_piStatus`, `homelab_serviceHealth`, `homelab_backupStatus` and `homelab_diskUsage` also accept `node: "all"` to query every node in parallel. State-changing tools require `confirm: true` and return a preview with `confirm: false`.

## Tools

| Category | Tool | Description |
|----------|------|-------------|
| System | `homelab_piStatus` | CPU temp, memory, disk, uptime, clock, voltage, decoded throttle flags |
| System | `homelab_piReboot` | Safe reboot with pre-checks (requires confirm=true) |
| System | `homelab_diskUsage` | Disk usage breakdown by directory |
| System | `homelab_aptUpdate` | Run apt update, list upgradable packages; optional upgrade (requires confirm=true) |
| Containers | `homelab_serviceHealth` | Docker container health status |
| Containers | `homelab_serviceLogs` | Tail container logs |
| Containers | `homelab_serviceRestart` | Restart a container (requires confirm=true) |
| Compose | `homelab_composeUp` | Start compose stacks (requires confirm=true) |
| Compose | `homelab_composeDown` | Stop compose stacks (requires confirm=true) |
| Compose | `homelab_composePull` | Pull latest images |
| Compose | `homelab_composePs` | List running containers |
| Network | `homelab_networkInfo` | IP addresses, DNS, Tailscale status |
| Backup | `homelab_backupStatus` | Check latest restic snapshots |
| Backup | `homelab_backupRun` | Trigger restic backup (requires confirm=true) |
| Backup | `homelab_backupList` | List all restic snapshots with filtering |
| Backup | `homelab_backupRestore` | Restore files from a snapshot (requires confirm=true) |
| Backup | `homelab_backupDiff` | Diff two restic snapshots |
| Backup | `homelab_backupCheck` | Verify repository integrity with restic check |
| Backup | `homelab_volumeBackup` | Back up a Docker volume to restic (requires confirm=true) |
| Monitoring | `homelab_prometheusQuery` | Run PromQL queries against Prometheus |
| Monitoring | `homelab_grafanaSnapshot` | Export Grafana dashboard config by UID |
| Monitoring | `homelab_uptimeKumaStatus` | Get Uptime Kuma monitor statuses |
| Monitoring | `homelab_alertList` | List Alertmanager alerts by state |
| Monitoring | `homelab_alertSilences` | List Alertmanager silences, optionally by state |
| Monitoring | `homelab_alertSilence` | Create or expire an Alertmanager silence (requires confirm=true) |
| Monitoring | `homelab_speedtestResults` | Get recent Speedtest Tracker results |
| DNS/Proxy | `homelab_adguardStats` | AdGuard Home DNS statistics |
| DNS/Proxy | `homelab_adguardFilters` | List AdGuard filter lists and status |
| DNS/Proxy | `homelab_adguardQueryLog` | Search AdGuard DNS query log |
| DNS/Proxy | `homelab_adguardFilterToggle` | Enable or disable an AdGuard filter list (requires confirm=true) |
| DNS/Proxy | `homelab_npmProxyHosts` | List NPM proxy host configs |
| DNS/Proxy | `homelab_npmCerts` | List SSL certificates and expiry |
| Security | `homelab_ufwStatus` | List UFW firewall rules and status |
| Security | `homelab_fail2banStatus` | List fail2ban jails and banned IPs |
| Security | `homelab_openPorts` | Scan listening TCP ports and map to processes |
| Security | `homelab_containerScan` | Scan container images for vulnerabilities via Trivy |
| Logs | `homelab_journalLogs` | Query systemd journal with unit, priority, time filters |
| Logs | `homelab_logSearch` | Search across container logs with grep patterns |
| Notifications | `homelab_ntfySend` | Send a push notification via Ntfy |
| Notifications | `homelab_ntfyTopics` | List Ntfy topics and recent messages |
| OS | `homelab_aptUpgradable` | List upgradable packages with version details |
| OS | `homelab_aptHistory` | Show recent apt install/upgrade/remove history |
| OS | `homelab_kernelInfo` | Kernel version, boot parameters, loaded modules |
| OS | `homelab_systemdServices` | List systemd units or get status of a specific unit |
| OS | `homelab_systemdControl` | Start, stop, restart, reload, enable or disable a systemd unit (requires confirm=true) |
| Certificates | `homelab_certCheck` | Check SSL certificate expiry, issuer, and fingerprint |
| Certificates | `homelab_certRenew` | Trigger Let's Encrypt certificate renewal (requires confirm=true) |
| Certificates | `homelab_certList` | List all managed certificates from certbot and NPM |
| Multi-Node | `homelab_nodeList` | List all managed nodes and connection status |
| Multi-Node | `homelab_nodeExec` | Execute a command on a specific node (requires confirm=true) |
| Multi-Node | `homelab_nodeStatus` | Get system status for a specific node |
| Multi-Node | `homelab_inventorySync` | Discover nodes from Ansible inventory or Tailscale |
| Diagnostics | `homelab_healthCheck` | Comprehensive self-test (SSH, Docker, curl, restic, certbot, systemd) |
| Diagnostics | `homelab_diagnostics` | Collect debug info bundle (OS, kernel, Docker, memory, disk, network) |
| SSH | `homelab_sshTest` | Test SSH connectivity |

## Setup

```bash
cd mcp-server
npm install
npm run build
```

## Configuration

Set environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `HOMELAB_PI_HOST` | `raspberrypi.local` | Pi hostname or IP |
| `HOMELAB_PI_USER` | `pi` | SSH username |
| `HOMELAB_PI_KEY_PATH` | (empty) | Path to SSH private key (e.g. `~/.ssh/id_ed25519`). When empty, only the SSH agent (`SSH_AUTH_SOCK`) is used for authentication |
| `HOMELAB_PI_PORT` | `22` | SSH port of the default node (1-65535) |
| `HOMELAB_COMPOSE_DIR` | `/opt/homelab/docker` | Compose project directory on Pi |
| `HOMELAB_COMPOSE_FILES` | (discovered) | Comma-separated compose files (in order) used when no `stacks` are passed. If unset, `compose.base.yml` and every `compose.*.yml` in the compose dir are used, falling back to `compose.yaml` / `docker-compose.yml` |
| `HOMELAB_BACKUP_REPO` | `/mnt/backup/restic` | Restic backup repo path on Pi |
| `HOMELAB_BACKUP_SCRIPT` | `/opt/backup/backup.sh` | Script `homelab_backupRun` runs with sudo (absolute path) |
| `HOMELAB_RESTIC_ENV_FILE` | `/etc/restic-env` | Env file on the node, sourced as root (when it exists) before every restic call, for `RESTIC_PASSWORD` and backend credentials. `none` disables it |
| `HOMELAB_RESTIC_PASSWORD_FILE` | (empty) | Restic password file on the node, passed as `--password-file` |
| `HOMELAB_GRAFANA_TOKEN` | (empty) | Grafana API token (preferred auth method) |
| `HOMELAB_GRAFANA_USER` | `admin` | Grafana basic auth username |
| `HOMELAB_GRAFANA_PASSWORD` | (empty) | Grafana basic auth password (falls back to admin/admin) |
| `HOMELAB_PROMETHEUS_PORT` | `9090` | Prometheus port override |
| `HOMELAB_GRAFANA_PORT` | `3000` | Grafana port override |
| `HOMELAB_ALERTMANAGER_PORT` | `9093` | Alertmanager port override |
| `HOMELAB_UPTIME_KUMA_PORT` | `3001` | Uptime Kuma port override |
| `HOMELAB_SPEEDTEST_PORT` | `8765` | Speedtest Tracker port override |
| `HOMELAB_ADGUARD_USER` | `admin` | AdGuard Home username |
| `HOMELAB_ADGUARD_PASSWORD` | `admin` | AdGuard Home password |
| `HOMELAB_ADGUARD_PORT` | `3000` | AdGuard Home web UI port. AdGuard and Grafana both default to 3000; if both run on the same host, set this (or `HOMELAB_GRAFANA_PORT`) to the port each actually uses |
| `HOMELAB_NPM_EMAIL` | `admin@example.com` | NPM admin email |
| `HOMELAB_NPM_PASSWORD` | `changeme` | NPM admin password |
| `HOMELAB_NPM_PORT` | `81` | NPM admin API port override |
| `HOMELAB_NTFY_PORT` | `8080` | Ntfy server port override |
| `HOMELAB_NODES` | (empty) | JSON object mapping node names to SSH config (`host` required; `user`, `keyPath`, `port` optional, `port` defaults to 22) for multi-node support. An optional `env` object overrides `HOMELAB_*` settings for that node (for example `HOMELAB_COMPOSE_DIR`, `HOMELAB_BACKUP_REPO`, service ports and credentials). Invalid JSON, an entry without `host`, or a node named `default` or `all` (reserved) is reported as an error |
| `HOMELAB_ANSIBLE_INVENTORY` | `/etc/ansible/hosts` | Ansible inventory file path for node discovery |
| `HOMELAB_DRY_RUN` | (unset) | When set to `true`, `1`, `yes`, or `on`, tools return the command they would run (the first one, for multi-step tools) without connecting |
| `HOMELAB_MAX_OUTPUT_BYTES` | `1048576` | Max bytes of command output kept per call; longer output is truncated to the last N bytes with a marker |
| `HOMELAB_ALLOW_DANGEROUS_COMMANDS` | (unset) | Set to `true` to bypass the runtime command safety guard |
| `HOMELAB_UPTIME_KUMA_SLUG` | `default` | Status page slug used by `homelab_uptimeKumaStatus` when no `slug` is passed |
| `HOMELAB_NTFY_TOPICS` | (unset) | Default topic list (comma-separated) for `homelab_ntfyTopics` when no `topic` is passed |
| `HOMELAB_SSH_TIMEOUT_MS` | `30000` | Default timeout (connect + command) for tools without their own budget. Long-running tools (apt upgrade, compose pull, restic backup/restore, image scans) use longer built-in timeouts |

## Resources and Prompts

Besides tools, the server exposes MCP resources and prompts, so any MCP client gets guided workflows.

| Kind | Name | Description |
|------|------|-------------|
| Resource | `homelab://nodes` | Managed nodes (name and host only) from `HOMELAB_PI_HOST` and `HOMELAB_NODES` |
| Prompt | `morning-health-check` | Read-only daily check: hardware, containers, active alerts, backups, disk. Optional `node`; `node: "all"` checks every node |
| Prompt | `pre-reboot-checklist` | Gathers state, backups and pending updates before a reboot; never reboots on its own. Optional `node` |
| Prompt | `post-reboot-verify` | Read-only check that the node and its containers came back after a reboot. Optional `node` and `containers` (the list `homelab_piReboot` prints) |
| Prompt | `investigate-container` | Status, logs and error search for one container with a proposed fix. Requires `service`, optional `node` |

## Usage with Cursor

Add to `.cursor/mcp.json` (the same `mcpServers` block works in other MCP clients). With the published package:

```json
{
  "mcpServers": {
    "homelab": {
      "command": "npx",
      "args": ["-y", "@tmhs/homelab-mcp"],
      "env": {
        "HOMELAB_PI_HOST": "raspberrypi.local",
        "HOMELAB_PI_USER": "pi",
        "HOMELAB_PI_KEY_PATH": "~/.ssh/id_ed25519"
      }
    }
  }
}
```

From a local build instead:

```json
{
  "mcpServers": {
    "homelab": {
      "command": "node",
      "args": ["path/to/Home-Lab-Developer-Tools/mcp-server/dist/index.js"],
      "env": {
        "HOMELAB_PI_HOST": "raspberrypi.local",
        "HOMELAB_PI_USER": "pi",
        "HOMELAB_PI_KEY_PATH": "~/.ssh/id_ed25519"
      }
    }
  }
}
```

## Development

```bash
npm run dev    # Watch mode with tsx
npm test       # Run Vitest tests
npm run build  # Compile TypeScript
```
