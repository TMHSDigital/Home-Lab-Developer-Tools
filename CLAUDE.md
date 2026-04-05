# CLAUDE.md

Project documentation for Claude Code and AI assistants working on this repository.

## Project Overview

Home Lab Developer Tools integrates home lab and Raspberry Pi workflows into AI-assisted development. It includes 14 skills, 6 rules, and a companion MCP server with 25 tools for managing Docker Compose stacks, monitoring, DNS, reverse proxy, networking, backups, and system administration via SSH.

**Works with:** Cursor (plugin), Claude Code (terminal and in-editor), and any MCP-compatible client.

This is a monorepo -- the skills, rules, and companion MCP server live in the same repository. The MCP server connects to a Raspberry Pi via SSH to execute commands.

**Version:** 0.3.0
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

## Skills (14)

| Skill | Description |
|-------|-------------|
| pi-system-management | Monitor Pi hardware -- temp, throttling, memory, reboots |
| docker-compose-stacks | Manage multi-file Docker Compose deployments |
| service-monitoring | Prometheus, Grafana, Uptime Kuma, alert rules |
| grafana-dashboards | Create, import, and manage Grafana dashboards |
| alerting-rules | Prometheus alerting rules and Alertmanager routing |
| network-configuration | AdGuard DNS, NPM, Tailscale VPN, port management |
| dns-management | AdGuard filters, local DNS records, blocklists |
| reverse-proxy-management | NPM routing, SSL config, access lists |
| backup-recovery | Restic backup config, scheduling, and restore |
| ssh-management | SSH keys, hardening, tunnels, troubleshooting |
| ansible-workflows | Ansible playbooks for multi-node management |
| security-hardening | UFW, fail2ban, SSH lockdown, container security |
| storage-management | Samba, Syncthing, volumes, disk monitoring |
| troubleshooting | Debug crashes, network issues, hardware problems |

## Rules (6)

| Rule | Scope | Description |
|------|-------|-------------|
| homelab-secrets | Global | Flag hardcoded passwords, IPs, SSH keys |
| compose-arm64 | compose*.yml | Flag arm64 incompatibility, missing healthchecks |
| ssh-safety | Global | Flag dangerous SSH commands |
| yaml-conventions | *.yml, *.yaml | Enforce formatting conventions |
| ansible-best-practices | ansible/**/*.yml | Flag Ansible antipatterns |
| exposed-ports | compose*.yml | Flag services with exposed host ports that should use a proxy |

## MCP Tools (25)

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
| `homelab_prometheusQuery` | Run a PromQL query against Prometheus |
| `homelab_grafanaSnapshot` | Export a Grafana dashboard configuration by UID |
| `homelab_uptimeKumaStatus` | Get the status of all Uptime Kuma monitors |
| `homelab_alertList` | List alerts from Alertmanager by state |
| `homelab_speedtestResults` | Get recent Speedtest Tracker results |
| `homelab_adguardStats` | AdGuard Home DNS statistics and top blocked domains |
| `homelab_adguardFilters` | List AdGuard filter/blocklists and status |
| `homelab_adguardQueryLog` | Search the AdGuard DNS query log |
| `homelab_npmProxyHosts` | List NPM proxy host configurations |
| `homelab_npmCerts` | List SSL certificates and expiry dates |
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

## Release Hygiene

When preparing a new release version, ALL of the following files must be updated to reflect the new version number, tool/skill/rule counts, and any new entries:

| File | What to update |
|------|----------------|
| `mcp-server/package.json` | `version` field |
| `mcp-server/src/index.ts` | `version` in McpServer constructor |
| `.cursor-plugin/plugin.json` | `version` field, `description` tool/skill/rule counts |
| `README.md` | Badge versions, stat line counts, tool/skill/rule tables, roadmap table |
| `CLAUDE.md` | `Version` field, skill/rule/tool counts and tables |
| `ROADMAP.md` | Move version from planned to completed, update status |
| `CHANGELOG.md` | Add new version section with all changes |
| `docs/index.html` | Update any version references or counts |

Checklist before pushing a release:

1. All new tools registered in `mcp-server/src/index.ts`
2. All new tools have input validation tests
3. All new skills have SKILL.md with required frontmatter and sections
4. All new rules have .mdc with required frontmatter
5. Structure tests pass (`pytest tests/ -v`)
6. MCP server builds and tests pass (`npm run build && npm test`)
7. Version numbers match across all files listed above
8. CHANGELOG.md entry added for the new version

Publishing pipeline (fully automated):

1. Push version bump in `mcp-server/package.json` to `main`
2. `auto-tag.yml` detects the change, creates git tag `vX.Y.Z`, creates GitHub Release, then builds, tests, and publishes to npm with provenance -- all in one workflow
3. `publish.yml` exists as a manual fallback only
4. Never create tags, releases, or npm publishes manually

## Home Lab Context

The target environment is a Raspberry Pi 5 running:
- 13 Docker containers (Prometheus, Grafana, AdGuard, NPM, Portainer, Homepage, Uptime Kuma, Vaultwarden, Ntfy, Syncthing, Code Server, Stirling PDF, Speedtest Tracker)
- Native services: Cockpit (:9090), Samba (:445), node_exporter (:9100)
- Docker Compose stacks at `/opt/homelab/docker/` split into: base, monitoring, network, apps, security, storage, tools
- Restic backups via systemd timer
- Management from Windows via SSH and PowerShell
