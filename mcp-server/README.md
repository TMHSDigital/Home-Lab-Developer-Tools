# Home Lab MCP Server

MCP (Model Context Protocol) server for home lab operations. Connects to a Raspberry Pi via SSH and provides 15 tools for system management, Docker Compose stacks, service monitoring, networking, and backups.

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
