# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.24.7] - 2026-11-19

### Changed

- `homelab_backupDiff` lists at most `limit` changed paths (default 100, 0 for statistics only) followed by restic's statistics and a note on how many paths were omitted, and allows 5 minutes instead of 30 seconds.

## [0.24.6] - 2026-11-19

### Changed

- `homelab_uptimeKumaStatus` returns one line per monitor (name, latest status, last check, ping, 24h uptime; problems first) instead of the raw status-page body with about 100 heartbeats per monitor, and reports an oversized response instead of returning cut JSON. The new `beats` parameter adds a short status history.

## [0.24.5] - 2026-11-19

### Fixed

- `homelab_piStatus`, `homelab_nodeStatus`, `homelab_networkInfo`, `homelab_diskUsage` and `homelab_kernelInfo` run each section independently: a failing probe (no default route, a stale network mount, Tailscale logged out) shows its own output and exit status instead of stopping the rest and failing the tool. Non-Pi nodes show `N/A` for the CPU temperature, and `homelab_inventorySync` tells an unreadable inventory from a missing one and a stopped Tailscale from a missing one.

## [0.24.4] - 2026-11-19

### Fixed

- `HOMELAB_DRY_RUN` no longer produces false results: `execSSH` raises a typed `DryRunError` instead of returning a description as if it were output, so `homelab_sshTest` no longer reports OK, `homelab_piReboot` no longer reports a sent reboot, and the NPM and AdGuard tools no longer report authentication errors. Every tool returns the command it would run; multi-step tools stop at the first one, `homelab_nodeList` shows nodes as not probed, and `node: "all"` shows each node's plan.

## [0.24.3] - 2026-11-19

### Fixed

- `homelab_composePull` with `stacks` no longer requires `compose.base.yml`: it uses the same project file resolution and stack-name validation as `homelab_composeUp` and pulls only the services of the requested stacks.

## [0.24.2] - 2026-11-19

### Fixed

- `homelab_logSearch` with `service` returns an error naming the container when it does not exist, instead of reporting "No matches found".

## [0.24.1] - 2026-11-19

### Fixed

- `homelab_prometheusQuery` and `homelab_adguardQueryLog` percent-encode `'`, `(`, `)`, `!` and `*` in query values, so PromQL with single-quoted strings such as `up{job='node'}` and searches containing quotes reach the service intact.

## [0.24.0] - 2026-11-19

### Added

- `homelab_systemdControl` starts, stops, restarts, reloads, enables or disables a native systemd unit (requires confirm=true), validates the unit name, refuses to stop or disable the SSH unit, and reports whether the unit is active and enabled afterwards. The security-hardening, storage-management and ansible-workflows skills use it instead of free-form `systemctl` commands through `homelab_nodeExec`.

## [0.23.0] - 2026-11-19

### Added

- `homelab_backupCheck` verifies restic repository integrity with `restic check`, optionally reading a subset of the data (`readDataSubset`, e.g. `5%`), using the repository password settings and a long timeout.

### Changed

- `homelab_backupStatus` starts with an `OK` or `STALE` verdict computed from the newest snapshot's age (`maxAgeHours`, default 26) and lists snapshots as compact one-line entries. The morning-health-check and pre-reboot-checklist prompts use the verdict.

## [0.22.2] - 2026-11-18

The changes below shipped across 0.17.1 to 0.22.2 and were not sorted by version at the time. See the [GitHub releases](https://github.com/TMHSDigital/Home-Lab-Developer-Tools/releases) for each version's notes.

### Added

- Every tool now declares MCP tool annotations: read-only tools set `readOnlyHint`, the confirm-gated tools set `destructiveHint` (with `idempotentHint`), and `homelab_composePull` and `homelab_ntfySend` are marked as state-changing but not destructive, so clients can auto-approve reads and warn before destructive calls. Tools are registered with `registerTool` instead of the deprecated `server.tool()`.
- `node: "all"` on `homelab_nodeStatus`, `homelab_piStatus` and `homelab_serviceHealth` queries every registered node in parallel and returns one section per node, with per-node errors for offline nodes.
- `HOMELAB_BACKUP_SCRIPT` (per-node overridable) sets the script `homelab_backupRun` runs; default `/opt/backup/backup.sh`.
- `homelab_alertSilences` lists Alertmanager silences (optionally by state), and `homelab_alertSilence` creates a silence from label matchers, a duration and a comment, or expires one by ID (requires confirm=true). The alerting-rules skill and the pre-reboot-checklist prompt use them for maintenance windows.
- Confirm-gated tools called without `confirm: true` now return a preview instead of only "cancelled": the target node and host, the command they would run (credentials masked), whether the command guard would block it, and any extra steps. Nothing is executed.
- Configurable SSH port: `HOMELAB_PI_PORT` for the default node and an optional `port` in `HOMELAB_NODES` entries (default 22, validated 1-65535). `homelab_sshTest` and `homelab_nodeList` show the port.

### Changed

- The MCP server is now built with TypeScript 7 (from 6). The emitted JavaScript and type declarations are unchanged.
- Node.js 22.12 or newer is now required (Node 20 reached end of life on 2026-04-30). CI tests Node 22 and 24.
- Releases now wait for the build and all tests to pass, and pushes that change only docs, tests or CI no longer publish a new version.
- `homelab_backupList` returns the newest `count` snapshots (default 20, max 200) as compact one-line entries instead of restic's full JSON. `homelab_prometheusQuery` returns at most `limit` series (default 100). JSON tools report a response that exceeded `HOMELAB_MAX_OUTPUT_BYTES` instead of returning cut, invalid JSON.

### Fixed

- `homelab_logSearch` no longer trips the command guard when the search text contains words like "poweroff" or "halt"; the pattern is passed to grep as data.
- `homelab_certRenew` with `domain` renews only when the certificate is due; the new `force` flag reissues it (mind the Let's Encrypt duplicate-certificate limit).
- `homelab_inventorySync` honors a per-node `HOMELAB_ANSIBLE_INVENTORY` from `HOMELAB_NODES`.
- Restic tools (`homelab_backupStatus`, `homelab_backupList`, `homelab_backupDiff`, `homelab_backupRestore`, `homelab_volumeBackup`) now get the repository password under sudo: they source `/etc/restic-env` (`HOMELAB_RESTIC_ENV_FILE`) when it exists and pass `HOMELAB_RESTIC_PASSWORD_FILE` as `--password-file`. Password failures name these settings.
- `homelab_composeUp` and `homelab_composeDown` with `stacks` now act only on the services of the named files. Updating one stack no longer removes other stacks' containers as orphans, and stopping one stack no longer stops base services.
- `homelab_serviceHealth` now includes stopped containers, flags non-running or unhealthy containers, and reports empty selections instead of claiming they are healthy.
- Failed SSH commands now retain diagnostics redirected to stdout. Inactive systemd units return their status, and certificate retrieval failures include a clear explanation and the command output.

## [0.22.1] - 2026-11-18

See [release notes](https://github.com/TMHSDigital/Home-Lab-Developer-Tools/releases/tag/v0.22.1) for details.

## [0.22.0] - 2026-11-18

See [release notes](https://github.com/TMHSDigital/Home-Lab-Developer-Tools/releases/tag/v0.22.0) for details.

## [0.21.1] - 2026-11-18

See [release notes](https://github.com/TMHSDigital/Home-Lab-Developer-Tools/releases/tag/v0.21.1) for details.

## [0.21.0] - 2026-11-18

See [release notes](https://github.com/TMHSDigital/Home-Lab-Developer-Tools/releases/tag/v0.21.0) for details.

## [0.20.3] - 2026-11-18

See [release notes](https://github.com/TMHSDigital/Home-Lab-Developer-Tools/releases/tag/v0.20.3) for details.

## [0.20.2] - 2026-11-18

See [release notes](https://github.com/TMHSDigital/Home-Lab-Developer-Tools/releases/tag/v0.20.2) for details.

## [0.20.1] - 2026-11-18

See [release notes](https://github.com/TMHSDigital/Home-Lab-Developer-Tools/releases/tag/v0.20.1) for details.

## [0.20.0] - 2026-11-18

See [release notes](https://github.com/TMHSDigital/Home-Lab-Developer-Tools/releases/tag/v0.20.0) for details.

## [0.19.0] - 2026-11-18

See [release notes](https://github.com/TMHSDigital/Home-Lab-Developer-Tools/releases/tag/v0.19.0) for details.

## [0.18.0] - 2026-11-18

See [release notes](https://github.com/TMHSDigital/Home-Lab-Developer-Tools/releases/tag/v0.18.0) for details.

## [0.17.6] - 2026-11-18

See [release notes](https://github.com/TMHSDigital/Home-Lab-Developer-Tools/releases/tag/v0.17.6) for details.

## [0.17.5] - 2026-11-18

See [release notes](https://github.com/TMHSDigital/Home-Lab-Developer-Tools/releases/tag/v0.17.5) for details.

## [0.17.4] - 2026-11-18

See [release notes](https://github.com/TMHSDigital/Home-Lab-Developer-Tools/releases/tag/v0.17.4) for details.

## [0.17.3] - 2026-11-18

See [release notes](https://github.com/TMHSDigital/Home-Lab-Developer-Tools/releases/tag/v0.17.3) for details.

## [0.17.2] - 2026-11-18

See [release notes](https://github.com/TMHSDigital/Home-Lab-Developer-Tools/releases/tag/v0.17.2) for details.

## [0.17.1] - 2026-11-18

See [release notes](https://github.com/TMHSDigital/Home-Lab-Developer-Tools/releases/tag/v0.17.1) for details.

## [0.17.0] - 2026-11-03

See [release notes](https://github.com/TMHSDigital/Home-Lab-Developer-Tools/releases/tag/v0.17.0) for details.

## [0.16.1] - 2026-11-03

See [release notes](https://github.com/TMHSDigital/Home-Lab-Developer-Tools/releases/tag/v0.16.1) for details.

## [0.16.0] - 2026-11-03

See [release notes](https://github.com/TMHSDigital/Home-Lab-Developer-Tools/releases/tag/v0.16.0) for details.

## [0.15.4] - 2026-11-03

See [release notes](https://github.com/TMHSDigital/Home-Lab-Developer-Tools/releases/tag/v0.15.4) for details.

## [0.15.3] - 2026-11-03

See [release notes](https://github.com/TMHSDigital/Home-Lab-Developer-Tools/releases/tag/v0.15.3) for details.

## [0.15.2] - 2026-05-24

See [release notes](https://github.com/TMHSDigital/Home-Lab-Developer-Tools/releases/tag/v0.15.2) for details.

## [0.15.1] - 2026-05-22

See [release notes](https://github.com/TMHSDigital/Home-Lab-Developer-Tools/releases/tag/v0.15.1) for details.

## [0.15.0] - 2026-05-22

See [release notes](https://github.com/TMHSDigital/Home-Lab-Developer-Tools/releases/tag/v0.15.0) for details.

## [0.14.0] - 2026-05-22

### Added

- Runtime command safety guard in `execSSH` -- blocks catastrophic patterns (`rm -rf /`, `mkfs` on block devices, `dd` to block devices, fork bomb, `chmod -R 777 /`, curl/wget pipe to shell, `poweroff`/`halt`/`shutdown -h`) before opening an SSH connection. Override with `HOMELAB_ALLOW_DANGEROUS_COMMANDS=true`.
- `HOMELAB_DRY_RUN` mode -- when set, `execSSH` returns a description string without connecting. Unsafe commands are still rejected in dry-run mode.
- `UnsafeCommandError` class in `utils/errors.ts` for runtime guard rejections.
- Shared `confirmParam` and `confirmCancelled` helpers in `utils/confirm-param.ts` consumed by all confirm-gated tools.
- `mcp-server/src/utils/__tests__/ssh-guard.test.ts` -- unit tests for the command guard and dry-run mode using the real module (no mock).

### Changed

- `homelab_serviceRestart`, `homelab_composeUp`, and `homelab_composeDown` now require `confirm=true` to proceed. Calls without it return a cancellation message and make no changes.
- Default SSH host changed from personal hostname to generic `raspberrypi.local`; default user changed from personal username to `pi`. Override via `HOMELAB_PI_HOST` and `HOMELAB_PI_USER`.
- All confirm-gated tools now use the shared `confirmParam`/`confirmCancelled` helpers for consistent messaging (standardizes "aborted" -> "cancelled" in `certRenew` and `nodeExec`).
- `composePull` remains ungated (pull only downloads images, does not change running state).

## [0.13.2] - 2026-04-26

See [release notes](https://github.com/TMHSDigital/Home-Lab-Developer-Tools/releases/tag/v0.13.2) for details.

## [0.13.1] - 2026-04-25

See [release notes](https://github.com/TMHSDigital/Home-Lab-Developer-Tools/releases/tag/v0.13.1) for details.

## [0.13.0] - 2026-04-25

See [release notes](https://github.com/TMHSDigital/Home-Lab-Developer-Tools/releases/tag/v0.13.0) for details.

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
