# Home Lab MCP Server

MCP (Model Context Protocol) server for home lab operations. Connects to a Raspberry Pi (or multiple nodes) via SSH and provides 48 tools for system management, Docker Compose stacks, service monitoring, networking, backups, disaster recovery, security auditing, log analysis, notifications, OS management, certificate lifecycle, and multi-node management. All tools accept an optional `node` parameter to target specific nodes.

## Tools

| Category | Tool | Description |
|----------|------|-------------|
| System | `homelab_piStatus` | CPU temp, memory, disk, uptime, throttle state |
| System | `homelab_piReboot` | Safe reboot with pre-checks |
| System | `homelab_diskUsage` | Disk usage breakdown by directory |
| System | `homelab_aptUpdate` | Run apt update, list upgradable packages |
| Containers | `homelab_serviceHealth` | Docker container health status |
| Containers | `homelab_serviceLogs` | Tail container logs |
| Containers | `homelab_serviceRestart` | Restart a container |
| Compose | `homelab_composeUp` | Start compose stacks |
| Compose | `homelab_composeDown` | Stop compose stacks |
| Compose | `homelab_composePull` | Pull latest images |
| Compose | `homelab_composePs` | List running containers |
| Network | `homelab_networkInfo` | IP addresses, DNS, Tailscale status |
| Backup | `homelab_backupStatus` | Check latest restic snapshots |
| Backup | `homelab_backupRun` | Trigger restic backup |
| Backup | `homelab_backupList` | List all restic snapshots with filtering |
| Backup | `homelab_backupRestore` | Restore files from a snapshot |
| Backup | `homelab_backupDiff` | Diff two restic snapshots |
| Backup | `homelab_volumeBackup` | Back up a Docker volume to restic |
| Monitoring | `homelab_prometheusQuery` | Run PromQL queries against Prometheus |
| Monitoring | `homelab_grafanaSnapshot` | Export Grafana dashboard config by UID |
| Monitoring | `homelab_uptimeKumaStatus` | Get Uptime Kuma monitor statuses |
| Monitoring | `homelab_alertList` | List Alertmanager alerts by state |
| Monitoring | `homelab_speedtestResults` | Get recent Speedtest Tracker results |
| DNS/Proxy | `homelab_adguardStats` | AdGuard Home DNS statistics |
| DNS/Proxy | `homelab_adguardFilters` | List AdGuard filter lists and status |
| DNS/Proxy | `homelab_adguardQueryLog` | Search AdGuard DNS query log |
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
| Certificates | `homelab_certCheck` | Check SSL certificate expiry, issuer, and fingerprint |
| Certificates | `homelab_certRenew` | Trigger Let's Encrypt certificate renewal |
| Certificates | `homelab_certList` | List all managed certificates from certbot and NPM |
| Multi-Node | `homelab_nodeList` | List all managed nodes and connection status |
| Multi-Node | `homelab_nodeExec` | Execute a command on a specific node |
| Multi-Node | `homelab_nodeStatus` | Get system status for a specific node |
| Multi-Node | `homelab_inventorySync` | Discover nodes from Ansible inventory or Tailscale |
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
| `HOMELAB_PI_HOST` | `raspi5.local` | Pi hostname or IP |
| `HOMELAB_PI_USER` | `tmhs` | SSH username |
| `HOMELAB_PI_KEY_PATH` | (empty) | Path to SSH private key |
| `HOMELAB_COMPOSE_DIR` | `/opt/homelab/docker` | Compose project directory on Pi |
| `HOMELAB_BACKUP_REPO` | `/mnt/backup/restic` | Restic backup repo path on Pi |
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
| `HOMELAB_ADGUARD_PORT` | `3000` | AdGuard Home port override |
| `HOMELAB_NPM_EMAIL` | `admin@example.com` | NPM admin email |
| `HOMELAB_NPM_PASSWORD` | `changeme` | NPM admin password |
| `HOMELAB_NPM_PORT` | `81` | NPM admin API port override |
| `HOMELAB_NTFY_PORT` | `8080` | Ntfy server port override |
| `HOMELAB_NODES` | (empty) | JSON object mapping node names to SSH config for multi-node support |
| `HOMELAB_ANSIBLE_INVENTORY` | `/etc/ansible/hosts` | Ansible inventory file path for node discovery |

## Usage with Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "homelab": {
      "command": "node",
      "args": ["path/to/Home-Lab-Developer-Tools/mcp-server/dist/index.js"],
      "env": {
        "HOMELAB_PI_HOST": "raspi5.local",
        "HOMELAB_PI_USER": "tmhs",
        "HOMELAB_PI_KEY_PATH": "~/.ssh/id_ed25519_pi"
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
