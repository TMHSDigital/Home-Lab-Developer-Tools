# CLAUDE.md

Project documentation for Claude Code and AI assistants working on this repository.

## Project Overview

Home Lab Developer Tools integrates home lab and Raspberry Pi workflows into AI-assisted development. It includes 10 skills, 5 rules, and a companion MCP server with 15 tools for managing Docker Compose stacks, monitoring, networking, backups, and system administration via SSH.

**Works with:** Cursor (plugin), Claude Code (terminal and in-editor), and any MCP-compatible client.

This is a monorepo -- the skills, rules, and companion MCP server live in the same repository. The MCP server connects to a Raspberry Pi via SSH to execute commands.

**Version:** 0.1.0
**License:** CC-BY-NC-ND-4.0
**npm:** @tmhs/homelab-mcp
**Author:** TMHSDigital

## Plugin Architecture

```
Home-Lab-Developer-Tools/
  .cursor-plugin/
    plugin.json              # Plugin manifest
  skills/
    <skill-name>/
      SKILL.md               # One skill per directory
  rules/
    <rule-name>.mdc           # Rule files
  mcp-server/
    src/
      index.ts               # MCP server entry point
      tools/                 # One file per MCP tool
      utils/
        ssh-api.ts           # SSH connection helpers
        errors.ts            # Custom error classes
  docs/
    index.html               # GitHub Pages site
  tests/                     # Python structure tests
```

## Skills (10)

| Skill | Description |
|-------|-------------|
| pi-system-management | Monitor Pi hardware -- temp, throttling, memory, reboots |
| docker-compose-stacks | Manage multi-file Docker Compose deployments |
| service-monitoring | Prometheus, Grafana, Uptime Kuma, alert rules |
| network-configuration | AdGuard DNS, NPM, Tailscale VPN, port management |
| backup-recovery | Restic backup config, scheduling, and restore |
| ssh-management | SSH keys, hardening, tunnels, troubleshooting |
| ansible-workflows | Ansible playbooks for multi-node management |
| security-hardening | UFW, fail2ban, SSH lockdown, container security |
| storage-management | Samba, Syncthing, volumes, disk monitoring |
| troubleshooting | Debug crashes, network issues, hardware problems |

## Rules (5)

| Rule | Scope | Description |
|------|-------|-------------|
| homelab-secrets | Global | Flag hardcoded passwords, IPs, SSH keys |
| compose-arm64 | compose*.yml | Flag arm64 incompatibility, missing healthchecks |
| ssh-safety | Global | Flag dangerous SSH commands |
| yaml-conventions | *.yml, *.yaml | Enforce formatting conventions |
| ansible-best-practices | ansible/**/*.yml | Flag Ansible antipatterns |

## MCP Tools (15)

All tools connect to the Pi via SSH using environment variables for configuration.

| Tool | Description |
|------|-------------|
| `homelab_piStatus` | CPU temp, memory, disk, uptime, throttle state |
| `homelab_piReboot` | Safe reboot with pre-checks (requires confirm=true) |
| `homelab_diskUsage` | Disk usage breakdown by directory |
| `homelab_aptUpdate` | Run apt update, optionally upgrade |
| `homelab_serviceHealth` | Docker container health status |
| `homelab_serviceLogs` | Tail container logs |
| `homelab_serviceRestart` | Restart a container |
| `homelab_composeUp` | Start compose stacks (all or specific) |
| `homelab_composeDown` | Stop compose stacks |
| `homelab_composePull` | Pull latest images |
| `homelab_composePs` | List running compose containers |
| `homelab_networkInfo` | IP addresses, DNS, Tailscale status |
| `homelab_backupStatus` | Check latest restic snapshots |
| `homelab_backupRun` | Trigger restic backup (requires confirm=true) |
| `homelab_sshTest` | Test SSH connectivity |

## Development

### MCP server

```bash
cd mcp-server
npm install
npm run build    # Compile TypeScript
npm test         # Run Vitest tests
npm run dev      # Watch mode with tsx
```

### Structure tests

```bash
pip install -r requirements-test.txt
pytest tests/ -v --tb=short
```

### Plugin development

Symlink the repo to your Cursor plugins directory, then reload Cursor.

### Global install via npm

```bash
npm install -g @tmhs/homelab-mcp
```

## Conventions

- Never use em dashes. Use regular dashes (-) or double dashes (--).
- Never use emojis.
- Tool names follow `homelab_camelCase`.
- Each tool file exports a `register(server)` function.
- All SSH interaction goes through `execSSH()` from `utils/ssh-api.ts`.
- Skills use kebab-case directory names with YAML frontmatter.
- Rules use kebab-case filenames with `description` and `alwaysApply` frontmatter.

## Home Lab Context

The target environment is a Raspberry Pi 5 running:
- 13 Docker containers (Prometheus, Grafana, AdGuard, NPM, Portainer, Homepage, Uptime Kuma, Vaultwarden, Ntfy, Syncthing, Code Server, Stirling PDF, Speedtest Tracker)
- Native services: Cockpit (:9090), Samba (:445), node_exporter (:9100)
- Docker Compose stacks at `/opt/homelab/docker/` split into: base, monitoring, network, apps, security, storage, tools
- Restic backups via systemd timer
- Management from Windows via SSH and PowerShell
