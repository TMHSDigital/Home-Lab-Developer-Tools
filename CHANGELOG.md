# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.10.0] - 2026-04-05

### Added

- 2 new MCP tools for testing and diagnostics
  - `homelab_healthCheck` -- comprehensive self-test (SSH, Docker, curl, restic, certbot, systemd)
  - `homelab_diagnostics` -- collect debug info bundle (OS, kernel, Docker, memory, disk, network)
- Integration tests with mocked SSH -- first tests covering actual tool handler logic
- E2E test suite gated behind `HOMELAB_TEST_PI=true` env var for live Pi testing
- `.github/workflows/e2e.yml` CI workflow for manual/scheduled E2E runs against a real Pi
- Input validation tests for both new tools

## [0.9.0] - 2026-04-05

### Added

- 4 new MCP tools for multi-node management
  - `homelab_nodeList` -- list all managed nodes and their connection status
  - `homelab_nodeExec` -- execute a command on a specific node by name (requires confirm=true)
  - `homelab_nodeStatus` -- get system status for a specific node (uptime, CPU, memory, disk)
  - `homelab_inventorySync` -- discover nodes from Ansible inventory or Tailscale
- 1 new skill
  - `multi-node-management` -- managing fleets, node inventory, parallel operations, cross-node monitoring
- 1 new rule
  - `inventory-consistency` -- flag nodes in config missing from HOMELAB_NODES registry
- `HOMELAB_NODES` env var for multi-node SSH configuration (JSON object)
- `HOMELAB_ANSIBLE_INVENTORY` env var for Ansible inventory path
- Input validation tests for all 4 new tools

### Changed

- **Infrastructure refactor:** `ssh-api.ts` now supports a node registry via `HOMELAB_NODES` env var
- `execSSH()` accepts an optional `node` parameter to target specific nodes
- All 44 existing tools now accept an optional `node` parameter (defaults to primary Pi)
- New `node-param.ts` utility provides shared zod schema fragment for the node parameter

## [0.8.0] - 2026-04-05

### Added

- 3 new MCP tools for SSL/TLS certificate management
  - `homelab_certCheck` -- check SSL certificate expiry, issuer, and fingerprint for a domain
  - `homelab_certRenew` -- trigger Let's Encrypt certificate renewal via certbot (requires confirm=true)
  - `homelab_certList` -- list all managed certificates from certbot and Nginx Proxy Manager
- 1 new skill
  - `certificate-management` -- Let's Encrypt, self-signed certs, renewal automation, NPM cert integration
- Input validation tests for all 3 new tools

## [0.7.0] - 2026-04-05

### Added

- 4 new MCP tools for OS and package management
  - `homelab_aptUpgradable` -- list upgradable packages with current and candidate versions
  - `homelab_aptHistory` -- show recent apt install, upgrade, and remove history
  - `homelab_kernelInfo` -- kernel version, boot parameters, and loaded modules
  - `homelab_systemdServices` -- list systemd units or get status of a specific unit
- 2 new skills
  - `os-update-management` -- unattended-upgrades config, kernel updates, reboot scheduling
  - `performance-tuning` -- kernel params, swap config, I/O scheduler, GPU memory split
- 1 new rule
  - `resource-limits` -- flag Docker Compose services without memory or CPU limits
- Input validation tests for all 4 new tools

## [0.6.0] - 2026-04-05

### Added

- 4 new MCP tools for log analysis and notifications
  - `homelab_journalLogs` -- query systemd journal with unit, priority, and time filters
  - `homelab_logSearch` -- search across container logs with grep patterns
  - `homelab_ntfySend` -- send a push notification via Ntfy
  - `homelab_ntfyTopics` -- list Ntfy topics and recent messages
- 2 new skills
  - `log-analysis` -- structured log querying, journald workflows, container log searching
  - `notification-workflows` -- Ntfy setup, alert routing, notification pipelines
- `HOMELAB_NTFY_PORT` env var for Ntfy port override (default 8080)
- Input validation tests for all 4 new tools

## [0.5.0] - 2026-04-05

### Added

- 4 new MCP tools for security hardening and auditing
  - `homelab_ufwStatus` -- list UFW firewall rules and status
  - `homelab_fail2banStatus` -- list fail2ban jails, banned IPs, and ban counts
  - `homelab_openPorts` -- scan for listening TCP ports and map to processes
  - `homelab_containerScan` -- scan container images for HIGH/CRITICAL vulnerabilities via Trivy
- 1 new skill
  - `secrets-management` -- managing credentials with Vaultwarden, env vars, Docker secrets, and security auditing
- 2 new rules
  - `privileged-containers` -- flag containers running with elevated privileges or missing security restrictions
  - `weak-credentials` -- flag default/weak passwords and insecure credential storage in compose files
- Input validation tests for all 4 new tools

## [0.4.0] - 2026-04-05

### Added

- 4 new MCP tools for backup and disaster recovery
  - `homelab_backupList` -- list all restic snapshots with optional path, tag, and host filtering
  - `homelab_backupRestore` -- restore files from a snapshot to a target path (requires confirm=true)
  - `homelab_backupDiff` -- show differences between two restic snapshots
  - `homelab_volumeBackup` -- back up a specific Docker volume to restic (requires confirm=true)
- 1 new skill
  - `disaster-recovery` -- full Pi restore workflow, SD card imaging, Docker volume recovery, migration checklist
- 1 new rule
  - `backup-coverage` -- flag Docker services with named volumes not covered by backup jobs
- `HOMELAB_BACKUP_REPO` env var support in all 4 new tools (default `/mnt/backup/restic`)
- Input validation tests for all 4 new tools

## [0.3.0] - 2026-04-05

### Added

- 5 new MCP tools for DNS and reverse proxy management
  - `homelab_adguardStats` -- AdGuard Home DNS statistics and top blocked domains
  - `homelab_adguardFilters` -- list AdGuard filter/blocklists and status
  - `homelab_adguardQueryLog` -- search the AdGuard DNS query log
  - `homelab_npmProxyHosts` -- list Nginx Proxy Manager proxy host configurations
  - `homelab_npmCerts` -- list SSL certificates and expiry dates
- 2 new skills
  - `dns-management` -- AdGuard filters, local DNS records, blocklists
  - `reverse-proxy-management` -- NPM routing, SSL config, access lists
- 1 new rule
  - `exposed-ports` -- flag Compose services with exposed host ports that should use a reverse proxy
- AdGuard authentication via `HOMELAB_ADGUARD_USER`/`HOMELAB_ADGUARD_PASSWORD`
- NPM authentication via `HOMELAB_NPM_EMAIL`/`HOMELAB_NPM_PASSWORD`
- Port overrides: `HOMELAB_ADGUARD_PORT`, `HOMELAB_NPM_PORT`
- Input validation tests for all 5 new tools

## [0.2.1] - 2026-04-05

### Fixed

- `grafanaSnapshot` now supports authentication via `HOMELAB_GRAFANA_TOKEN` (API key) or `HOMELAB_GRAFANA_USER`/`HOMELAB_GRAFANA_PASSWORD` (basic auth)
- All 5 v0.2.0 tools now return human-readable error messages when a service is unreachable (e.g. "Could not connect to Alertmanager on port 9093. Is it running?") instead of raw curl exit codes
- All 5 v0.2.0 tools now support optional port overrides via env vars (`HOMELAB_PROMETHEUS_PORT`, `HOMELAB_GRAFANA_PORT`, `HOMELAB_ALERTMANAGER_PORT`, `HOMELAB_UPTIME_KUMA_PORT`, `HOMELAB_SPEEDTEST_PORT`)
- Updated `.env.example` and `mcp-server/README.md` with new env var documentation

## [0.2.0] - 2026-04-05

### Added

- 5 new MCP tools for monitoring stack integration
  - `homelab_prometheusQuery` -- run PromQL queries against Prometheus
  - `homelab_grafanaSnapshot` -- export Grafana dashboard configs by UID
  - `homelab_uptimeKumaStatus` -- get all Uptime Kuma monitor statuses
  - `homelab_alertList` -- list Alertmanager alerts with optional state filter
  - `homelab_speedtestResults` -- get recent Speedtest Tracker results
- 2 new skills
  - `grafana-dashboards` -- creating, importing, and managing Grafana dashboards
  - `alerting-rules` -- writing Prometheus alerting rules and Alertmanager routing
- Input validation tests for all 5 new tools

## [0.1.0] - 2026-04-05

### Added

- Initial project scaffold
- 10 skills for home lab management
  - pi-system-management, docker-compose-stacks, service-monitoring
  - network-configuration, backup-recovery, ssh-management
  - ansible-workflows, security-hardening, storage-management, troubleshooting
- 5 rules for best-practice enforcement
  - homelab-secrets, compose-arm64, ssh-safety, yaml-conventions, ansible-best-practices
- 15 MCP tools via SSH to Raspberry Pi
  - System: piStatus, piReboot, diskUsage, aptUpdate
  - Containers: serviceHealth, serviceLogs, serviceRestart
  - Compose: composeUp, composeDown, composePull, composePs
  - Network: networkInfo
  - Backup: backupStatus, backupRun
  - SSH: sshTest
- Plugin manifest (.cursor-plugin/plugin.json)
- Python structure tests for skills, rules, and docs
- Vitest input validation tests for MCP tools
- CI/CD workflows (ci.yml, validate.yml)
- Full documentation (README, CLAUDE.md, CONTRIBUTING, ROADMAP, SECURITY)
- Project logo (assets/logo.png)

[0.10.0]: https://github.com/TMHSDigital/Home-Lab-Developer-Tools/releases/tag/v0.10.0
[0.9.0]: https://github.com/TMHSDigital/Home-Lab-Developer-Tools/releases/tag/v0.9.0
[0.8.0]: https://github.com/TMHSDigital/Home-Lab-Developer-Tools/releases/tag/v0.8.0
[0.7.0]: https://github.com/TMHSDigital/Home-Lab-Developer-Tools/releases/tag/v0.7.0
[0.6.0]: https://github.com/TMHSDigital/Home-Lab-Developer-Tools/releases/tag/v0.6.0
[0.5.0]: https://github.com/TMHSDigital/Home-Lab-Developer-Tools/releases/tag/v0.5.0
[0.4.0]: https://github.com/TMHSDigital/Home-Lab-Developer-Tools/releases/tag/v0.4.0
[0.3.0]: https://github.com/TMHSDigital/Home-Lab-Developer-Tools/releases/tag/v0.3.0
[0.2.1]: https://github.com/TMHSDigital/Home-Lab-Developer-Tools/releases/tag/v0.2.1
[0.2.0]: https://github.com/TMHSDigital/Home-Lab-Developer-Tools/releases/tag/v0.2.0
[0.1.0]: https://github.com/TMHSDigital/Home-Lab-Developer-Tools/releases/tag/v0.1.0
