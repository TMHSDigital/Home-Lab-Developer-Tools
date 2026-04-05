# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.1.0]: https://github.com/TMHSDigital/Home-Lab-Developer-Tools/releases/tag/v0.1.0
