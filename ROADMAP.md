# Roadmap

## Version History

| Version | Theme | MCP Tools | Status |
|---------|-------|-----------|--------|
| **v0.1.0** | Foundation | 15 | Current |
| v0.2.0 | Extended Monitoring | +5 | Planned |
| v0.3.0 | Multi-Node | +5 | Planned |
| v1.0.0 | Stable | +0 | Planned |

## v0.1.0 - Foundation (current)

- [x] 10 skills covering core home lab workflows
- [x] 5 rules for best-practice enforcement
- [x] 15 MCP tools for Pi management via SSH
- [x] Plugin manifest and structure tests
- [x] CI/CD pipelines

## v0.2.0 - Extended Monitoring (planned)

- [ ] `homelab_prometheusQuery` - Run PromQL queries against Prometheus
- [ ] `homelab_grafanaSnapshot` - Export Grafana dashboard snapshots
- [ ] `homelab_uptimeKumaStatus` - Get Uptime Kuma monitor statuses
- [ ] `homelab_alertList` - List active Alertmanager alerts
- [ ] `homelab_speedtestResults` - Get recent speedtest results
- [ ] New skill: grafana-dashboards (creating and managing dashboards)
- [ ] New skill: alerting-rules (writing Prometheus alert rules)

## v0.3.0 - Multi-Node (planned)

- [ ] Support for multiple SSH targets (not just one Pi)
- [ ] `homelab_nodeList` - List all managed nodes and their status
- [ ] `homelab_nodeExec` - Execute a command on a specific node
- [ ] `homelab_inventorySync` - Sync Ansible inventory with discovered nodes
- [ ] `homelab_tailscaleNodes` - List Tailscale network nodes
- [ ] New skill: multi-node-management
- [ ] New rule: inventory-consistency

## v1.0.0 - Stable (planned)

- [ ] All tools tested against live Pi environments
- [ ] npm package published (@tmhs/homelab-mcp)
- [ ] Comprehensive documentation and examples
- [ ] GitHub Pages site with full tool reference

## Completed

- v0.1.0: Foundation release with 15 tools, 10 skills, 5 rules
