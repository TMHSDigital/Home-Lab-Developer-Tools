# Home Lab Developer Tools

**Home lab and Raspberry Pi workflows for Cursor, Claude Code, and any MCP-compatible editor.**

Version 0.1.0 | CC-BY-NC-ND-4.0 License | npm: @tmhs/homelab-mcp

**10 skills** -- **5 rules** -- **15 MCP tools**

---

## Compatibility

| Component | Cursor | Claude Code (terminal) | Claude Code in Cursor | Other MCP clients |
|-----------|--------|------------------------|-----------------------|-------------------|
| **CLAUDE.md** context | Yes | Yes | Yes | - |
| **10 Skills** (SKILL.md) | Yes | Yes | Yes | - |
| **5 Rules** (.mdc) | Yes | Via CLAUDE.md | Yes | - |
| **15 MCP tools** | Yes | Yes | Yes | Yes |

## Quick Start

Install the plugin, then ask anything about your home lab:

```
"What's the CPU temperature on my Pi?"
"Restart the Grafana container"
"Show me which services are unhealthy"
"Pull latest images and redeploy the monitoring stack"
```

## How It Works

The MCP server connects to your Raspberry Pi via SSH. Skills teach AI assistants how to manage home lab infrastructure. Rules enforce best practices automatically.

---

**10 Skills** - on-demand home lab expertise

| Category | Skill | Description |
|----------|-------|-------------|
| **System** | pi-system-management | Monitor Pi hardware -- temp, throttling, memory, reboots |
| **Containers** | docker-compose-stacks | Manage multi-file Docker Compose deployments |
| **Monitoring** | service-monitoring | Prometheus, Grafana, Uptime Kuma, alert rules |
| **Network** | network-configuration | AdGuard DNS, NPM reverse proxy, Tailscale VPN |
| **Backup** | backup-recovery | Restic backup config, scheduling, and restore |
| **SSH** | ssh-management | SSH keys, hardening, tunnels, troubleshooting |
| **Automation** | ansible-workflows | Ansible playbooks for multi-node management |
| **Security** | security-hardening | UFW, fail2ban, SSH lockdown, container security |
| **Storage** | storage-management | Samba, Syncthing, volumes, disk monitoring |
| **Debug** | troubleshooting | Debug crashes, network issues, hardware problems |

**5 Rules** - automatic best-practice enforcement

| Rule | Scope | What It Does |
|------|-------|--------------|
| homelab-secrets | Global (always active) | Flag hardcoded passwords, IPs, and SSH keys |
| compose-arm64 | Compose files | Flag images without arm64 support, missing healthchecks |
| ssh-safety | Global (always active) | Flag dangerous SSH commands (rm -rf, dd, mkfs) |
| yaml-conventions | YAML files | Enforce 2-space indent, document start, explicit booleans |
| ansible-best-practices | Ansible files | Flag non-FQCN modules, missing tags, shell misuse |

---

## Companion: Home Lab MCP Server

The MCP server gives your AI assistant live access to your Raspberry Pi via SSH. Works with Cursor, Claude Code, and any MCP-compatible client.

Add to your Cursor MCP config (`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "homelab": {
      "command": "node",
      "args": ["./mcp-server/dist/index.js"],
      "cwd": "<path-to>/Home-Lab-Developer-Tools",
      "env": {
        "HOMELAB_PI_HOST": "raspi5.local",
        "HOMELAB_PI_USER": "tmhs",
        "HOMELAB_PI_KEY_PATH": "~/.ssh/id_ed25519_pi"
      }
    }
  }
}
```

**15 MCP Tools**

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

---

## Installation

### Cursor (plugin + MCP)

Symlink this repo into your Cursor plugins directory:

```powershell
# Windows (PowerShell - run as admin)
New-Item -ItemType SymbolicLink `
  -Path "$env:USERPROFILE\.cursor\plugins\home-lab-developer-tools" `
  -Target "<path-to>\Home-Lab-Developer-Tools"
```

```bash
# macOS / Linux
ln -s /path/to/Home-Lab-Developer-Tools ~/.cursor/plugins/home-lab-developer-tools
```

Build and configure the MCP server:

```bash
cd mcp-server
npm install
npm run build
```

Then add the JSON config from the MCP Server section to `.cursor/mcp.json`.

### Claude Code (terminal or in Cursor)

Claude Code reads `CLAUDE.md` automatically when you open this repo. For the MCP server, register it with:

```bash
cd mcp-server && npm install && npm run build
claude mcp add homelab node ./mcp-server/dist/index.js
```

Or if installed globally via npm:

```bash
npm install -g @tmhs/homelab-mcp
claude mcp add homelab -- npx @tmhs/homelab-mcp
```

### Other MCP clients

Any client supporting MCP stdio transport can use the Home Lab MCP server. Point it at `node ./mcp-server/dist/index.js` or the global `npx @tmhs/homelab-mcp`.

---

## Example Prompts

| Skill | Try This |
|-------|----------|
| pi-system-management | "Is my Pi overheating? Check the CPU temp and throttle status" |
| docker-compose-stacks | "Pull latest images and redeploy the monitoring stack" |
| service-monitoring | "Set up a Prometheus alert for when disk usage exceeds 85%" |
| network-configuration | "Configure AdGuard to block ads for all devices on my network" |
| backup-recovery | "When was the last backup? Show me the recent snapshots" |
| ssh-management | "Harden my SSH config -- disable password auth, change the port" |
| ansible-workflows | "Write an Ansible playbook to deploy all compose stacks" |
| security-hardening | "Audit my Pi's firewall rules and suggest improvements" |
| storage-management | "Which directories are using the most disk space?" |
| troubleshooting | "Grafana won't start -- help me debug the container" |

---

## Related Projects

- [Home-Lab](https://github.com/TMHSDigital/Home-Lab) - The infrastructure repo this toolkit manages
- [raspi5-win-bootstrap](https://github.com/TMHSDigital/raspi5-win-bootstrap) - Day-0 Pi setup
- [Docker-Developer-Tools](https://github.com/TMHSDigital/Docker-Developer-Tools) - Docker workflows plugin (same structure)

## Contributing

Contributions welcome - see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

**CC-BY-NC-ND-4.0** - Copyright 2026 TM Hospitality Strategies. See [LICENSE](LICENSE).

Built by [TMHSDigital](https://github.com/TMHSDigital)
