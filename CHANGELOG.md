# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.2.1]: https://github.com/TMHSDigital/Home-Lab-Developer-Tools/releases/tag/v0.2.1
[0.2.0]: https://github.com/TMHSDigital/Home-Lab-Developer-Tools/releases/tag/v0.2.0
[0.1.0]: https://github.com/TMHSDigital/Home-Lab-Developer-Tools/releases/tag/v0.1.0
