# Roadmap

## Version Summary

| Version | Theme | New Tools | New Skills | New Rules | Cumulative Tools |
|---------|-------|-----------|------------|-----------|-----------------|
| **v0.1.0** | Foundation | 15 | 10 | 5 | 15 |
| v0.2.0 | Extended Monitoring | +5 | +2 | -- | 20 |
| v0.3.0 | DNS and Reverse Proxy | +5 | +2 | +1 | 25 |
| v0.4.0 | Backup and Recovery | +4 | +1 | +1 | 29 |
| v0.5.0 | Security Hardening | +4 | +1 | +2 | 33 |
| v0.6.0 | Logs and Notifications | +4 | +2 | -- | 37 |
| v0.7.0 | OS and Package Management | +4 | +2 | +1 | 41 |
| v0.8.0 | SSL/TLS Certificates | +3 | +1 | -- | 44 |
| v0.9.0 | Multi-Node Foundation | +4 | +1 | +1 | 48 |
| v0.10.0 | Testing Infrastructure | +2 | -- | -- | 50 |
| v0.11.0 | Documentation Site | -- | -- | -- | 50 |
| v0.12.0 | Polish and Hardening | +2 | -- | -- | 52 |
| **v1.0.0** | **Stable Release** | -- | -- | -- | **52** |

---

## v0.1.0 - Foundation (current)

- [x] 10 skills covering core home lab workflows
- [x] 5 rules for best-practice enforcement
- [x] 15 MCP tools for Pi management via SSH
- [x] Plugin manifest and structure tests
- [x] CI/CD pipelines (validate, typecheck, CodeQL, release drafter, npm publish)
- [x] npm package published (`@tmhs/homelab-mcp`)

---

## v0.2.0 - Extended Monitoring

Deep integration with the monitoring stack already running on the Pi.

**MCP tools (+5):**

- [x] `homelab_prometheusQuery` -- run PromQL queries against Prometheus
- [x] `homelab_grafanaSnapshot` -- export Grafana dashboard snapshots
- [x] `homelab_uptimeKumaStatus` -- get Uptime Kuma monitor statuses
- [x] `homelab_alertList` -- list active Alertmanager alerts
- [x] `homelab_speedtestResults` -- get recent Speedtest Tracker results

**Skills (+2):**

- [x] `grafana-dashboards` -- creating and managing dashboards
- [x] `alerting-rules` -- writing Prometheus alert rules

---

## v0.3.0 - DNS and Reverse Proxy

Manage the network gateway layer -- AdGuard Home and Nginx Proxy Manager.

**MCP tools (+5):**

- [x] `homelab_adguardStats` -- query/filter stats, top blocked domains
- [x] `homelab_adguardFilters` -- list/toggle filter lists
- [x] `homelab_adguardQueryLog` -- search DNS query log
- [x] `homelab_npmProxyHosts` -- list proxy host configs from NPM
- [x] `homelab_npmCerts` -- list SSL certificates and expiry dates

**Skills (+2):**

- [x] `dns-management` -- AdGuard filters, local DNS records, blocklists
- [x] `reverse-proxy-management` -- NPM routing, SSL config, access lists

**Rules (+1):**

- [x] `exposed-ports` -- flag services bound to 0.0.0.0 or missing proxy config

---

## v0.4.0 - Backup and Recovery

Go beyond "check status / trigger backup" to full disaster recovery workflows.

**MCP tools (+4):**

- [x] `homelab_backupList` -- list all restic snapshots with filtering
- [x] `homelab_backupRestore` -- restore files from a snapshot (requires confirm=true)
- [x] `homelab_backupDiff` -- diff two snapshots
- [x] `homelab_volumeBackup` -- backup a specific Docker volume

**Skills (+1):**

- [x] `disaster-recovery` -- full Pi restore workflow, SD card imaging, migration checklist

**Rules (+1):**

- [x] `backup-coverage` -- flag Docker volumes not covered by any backup job

---

## v0.5.0 - Security Hardening

Deeper security tooling and automated auditing.

**MCP tools (+4):**

- [x] `homelab_ufwStatus` -- list UFW rules and status
- [x] `homelab_fail2banStatus` -- list jails, banned IPs, recent bans
- [x] `homelab_openPorts` -- scan for listening ports and map to services
- [x] `homelab_containerScan` -- check running containers for known vulnerabilities (via Trivy or similar)

**Skills (+1):**

- [x] `secrets-management` -- managing credentials with Vaultwarden, env vars, Docker secrets

**Rules (+2):**

- [x] `privileged-containers` -- flag containers running as root or with privileged mode
- [x] `weak-credentials` -- flag default/weak passwords in compose env vars

---

## v0.6.0 - Logs and Notifications

Centralized log access and alerting pipelines.

**MCP tools (+4):**

- [x] `homelab_journalLogs` -- query systemd journal with filters (unit, priority, time range)
- [x] `homelab_logSearch` -- search across container logs with grep patterns
- [x] `homelab_ntfySend` -- send a notification via Ntfy
- [x] `homelab_ntfyTopics` -- list Ntfy topics and recent messages

**Skills (+2):**

- [x] `log-analysis` -- structured log querying, journald workflows, container log searching
- [x] `notification-workflows` -- Ntfy setup, alert routing, notification pipelines

---

## v0.7.0 - OS and Package Management

System-level maintenance beyond apt update.

**MCP tools (+4):**

- [ ] `homelab_aptUpgradable` -- list upgradable packages with version details
- [ ] `homelab_aptHistory` -- show recent apt install/upgrade history
- [ ] `homelab_kernelInfo` -- kernel version, loaded modules, boot params
- [ ] `homelab_systemdServices` -- list systemd units, enable/disable/status

**Skills (+2):**

- [ ] `os-update-management` -- unattended-upgrades config, kernel updates, reboot scheduling
- [ ] `performance-tuning` -- kernel params, swap config, I/O scheduler, GPU memory split

**Rules (+1):**

- [ ] `resource-limits` -- flag containers without memory/CPU limits set

---

## v0.8.0 - SSL/TLS Certificates

Certificate lifecycle management.

**MCP tools (+3):**

- [ ] `homelab_certCheck` -- check SSL cert expiry for a domain/host
- [ ] `homelab_certRenew` -- trigger Let's Encrypt renewal (requires confirm=true)
- [ ] `homelab_certList` -- list all managed certificates and their status

**Skills (+1):**

- [ ] `certificate-management` -- Let's Encrypt, self-signed certs, renewal automation, NPM cert integration

---

## v0.9.0 - Multi-Node Foundation

Support managing multiple SSH targets. Core infrastructure change.

**MCP tools (+4):**

- [ ] `homelab_nodeList` -- list all managed nodes and their connection status
- [ ] `homelab_nodeExec` -- execute a command on a specific node by name
- [ ] `homelab_nodeStatus` -- get system status for a specific node (like piStatus but for any node)
- [ ] `homelab_inventorySync` -- sync/discover nodes from Ansible inventory or Tailscale

**Infrastructure changes:**

- [ ] `ssh-api.ts` refactored to support a node registry (env var or config file for multiple hosts)
- [ ] All existing tools gain optional `node` parameter (defaults to primary Pi)

**Skills (+1):**

- [ ] `multi-node-management` -- managing fleets, inventory, parallel operations

**Rules (+1):**

- [ ] `inventory-consistency` -- flag nodes in inventory but unreachable, or missing from inventory

---

## v0.10.0 - Testing Infrastructure

Real test coverage before v1.0.

**MCP tools (+2):**

- [ ] `homelab_healthCheck` -- comprehensive self-test (SSH connectivity, Docker availability, required tools present)
- [ ] `homelab_diagnostics` -- collect debug info bundle (versions, connectivity, config)

**Testing layers:**

- [ ] Integration tests with mocked SSH (ssh2-mock or similar)
- [ ] E2E test suite that runs against a real Pi (gated behind `HOMELAB_TEST_PI=true` env var)
- [ ] CI workflow that connects to a Pi via Tailscale for e2e (self-hosted runner or SSH tunnel)

---

## v0.11.0 - Documentation Site

Upgrade GitHub Pages from placeholder to full tool reference.

**Site features:**

- [ ] Interactive tool reference with parameters, examples, and output samples
- [ ] Skill catalog with trigger conditions and example prompts
- [ ] Rule catalog with scope and example violations
- [ ] Search functionality
- [ ] Dark/light mode

**Docs automation:**

- [ ] Rule or CLAUDE.md section ensuring all release-related info (version numbers, tool counts, changelogs) is updated across README, CLAUDE.md, ROADMAP.md, plugin.json, package.json, and the docs site on every release

---

## v0.12.0 - Polish and Hardening

Final quality pass before stable.

**MCP tools (+2):**

- [ ] `homelab_configExport` -- export current MCP server config (sanitized, no secrets)
- [ ] `homelab_configValidate` -- validate environment setup and required Pi-side dependencies

**Quality pass:**

- [ ] All tools reviewed for error handling, timeout tuning, and output formatting
- [ ] All skills reviewed for accuracy, completeness, and cross-linking
- [ ] All rules reviewed for false positive rates
- [ ] README, CLAUDE.md, ROADMAP.md, plugin.json, package.json fully in sync
- [ ] CHANGELOG complete for all versions

---

## v1.0.0 - Stable Release

Production-ready, fully tested, fully documented.

**Release criteria:**

- [ ] All tools tested against live Pi environments (e2e CI green)
- [ ] npm package published with provenance (`@tmhs/homelab-mcp`)
- [ ] GitHub Pages site live with full tool/skill/rule reference
- [ ] Multi-node support functional
- [ ] No known bugs in issue tracker
- [ ] CHANGELOG, README, CLAUDE.md, ROADMAP.md, plugin.json all version-synced

**Final counts: ~52 MCP tools, ~22 skills, ~11 rules**

---

## Completed

- v0.6.0: Logs and Notifications -- 4 new tools (journalLogs, logSearch, ntfySend, ntfyTopics), 2 new skills (log-analysis, notification-workflows)
- v0.5.0: Security Hardening -- 4 new tools (ufwStatus, fail2banStatus, openPorts, containerScan), 1 new skill (secrets-management), 2 new rules (privileged-containers, weak-credentials)
- v0.4.0: Backup and Recovery -- 4 new tools (backupList, backupRestore, backupDiff, volumeBackup), 1 new skill (disaster-recovery), 1 new rule (backup-coverage)
- v0.3.0: DNS and Reverse Proxy -- 5 new tools (adguardStats, adguardFilters, adguardQueryLog, npmProxyHosts, npmCerts), 2 new skills (dns-management, reverse-proxy-management), 1 new rule (exposed-ports)
- v0.2.0: Extended Monitoring -- 5 new tools (prometheusQuery, grafanaSnapshot, uptimeKumaStatus, alertList, speedtestResults), 2 new skills (grafana-dashboards, alerting-rules)
- v0.1.0: Foundation release with 15 tools, 10 skills, 5 rules
