---
name: grafana-dashboards
description: Create, import, export, and manage Grafana dashboards for home lab observability.
tools:
  - homelab_grafanaSnapshot
  - homelab_prometheusQuery
standards-version: 1.9.0
---

# Grafana Dashboards

Create, import, and manage Grafana dashboards on a Raspberry Pi home lab. Covers
dashboard provisioning, panel configuration, variable templating, data source
setup, and JSON export/import workflows.

## Trigger

- User asks about creating or editing a Grafana dashboard
- User wants to visualize specific metrics (CPU, memory, disk, network, container stats)
- User mentions "Grafana", "dashboard", "panel", "graph", or "visualization"
- User asks to export or back up a dashboard
- User wants to add a new data source to Grafana
- User asks about Grafana variables or templating

## Required Inputs

- SSH connectivity to the Raspberry Pi (validated via `homelab_sshTest`)
- Grafana running on port 3000

Optional:
- Dashboard UID for export operations
- Specific metrics or PromQL queries for panel creation
- Data source configuration details

## Workflow

1. **Verify connectivity** -- call `homelab_sshTest`.
2. **Check Grafana health** -- call `homelab_serviceHealth` for the Grafana container.
3. **For exporting a dashboard:**
   - Call `homelab_grafanaSnapshot` with the dashboard UID
   - Return the JSON configuration for backup or migration
4. **For creating a new dashboard:**
   - Determine the target metrics using `homelab_prometheusQuery` to verify data availability
   - Build the dashboard JSON with appropriate panels (graph, stat, gauge, table)
   - Guide the user through provisioning or API import
5. **For modifying an existing dashboard:**
   - Export the current config via `homelab_grafanaSnapshot`
   - Apply changes to the JSON structure
   - Re-import via the Grafana API or provisioning directory
6. **For data source setup:**
   - Guide configuration of Prometheus as the primary data source at `http://prometheus:9090`
   - Verify connectivity from Grafana to the data source
7. **Verify the result** -- confirm the dashboard loads correctly and displays data.

## Key References

Grafana service:
- Grafana UI: `http://pi:3000`
- Default credentials: admin/admin (should be changed)
- API endpoint: `http://localhost:3000/api/`

File locations:
```
/opt/homelab/docker/monitoring/
  grafana/provisioning/
    dashboards/           # Dashboard provisioning config
    datasources/          # Data source provisioning config
  grafana/dashboards/     # Provisioned dashboard JSON files
```

Common dashboard UIDs:
- Node Exporter Full: `rYdddlPWk`
- Docker containers: varies by installation

Useful PromQL for dashboards:
- CPU usage: `100 - (avg by(instance) (irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)`
- Memory usage: `(1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100`
- Disk usage: `(1 - node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}) * 100`
- Container CPU: `rate(container_cpu_usage_seconds_total[5m])`

## Example Interaction

**User:** "Export my main Pi dashboard from Grafana"

**Assistant actions:**
1. Call `homelab_sshTest`
2. Call `homelab_grafanaSnapshot` with the dashboard UID
3. Return the JSON config

**Response:**
> Here is the full JSON export for dashboard `rYdddlPWk` (Node Exporter Full).
> It contains 24 panels across 6 rows covering CPU, memory, disk, network, and
> system load. You can re-import this via the Grafana UI at Settings > JSON Model
> or place it in the provisioning directory.

**User:** "Create a dashboard showing my Pi's temperature over time"

**Assistant actions:**
1. Verify data exists: call `homelab_prometheusQuery` with `node_thermal_zone_temp`
2. Build a dashboard JSON with a time-series panel
3. Guide the user through import

## MCP Usage

| Tool                          | Purpose                                       |
|-------------------------------|-----------------------------------------------|
| `homelab_sshTest`             | Validate connectivity before operations       |
| `homelab_grafanaSnapshot`     | Export dashboard JSON by UID                  |
| `homelab_prometheusQuery`     | Verify metric availability for panels         |
| `homelab_serviceHealth`       | Check Grafana container health                |
| `homelab_serviceLogs`         | Debug Grafana issues                          |
| `homelab_serviceRestart`      | Restart Grafana after provisioning changes    |

## Common Pitfalls

- **Provisioned dashboards are read-only** -- dashboards loaded from the provisioning
  directory cannot be edited in the Grafana UI. Either edit the JSON file and restart
  Grafana, or save as a new (non-provisioned) dashboard.
- **Dashboard UID vs ID** -- the API uses UIDs (alphanumeric strings), not numeric IDs.
  Always use the UID for export and import operations.
- **Data source name mismatch** -- if a dashboard references a data source by name
  (e.g., "Prometheus") but the configured name differs, panels will show "No data".
  Check data source names match exactly.
- **Time range confusion** -- Grafana defaults to "Last 6 hours". If data appears
  missing, check the time range selector before investigating Prometheus.
- **Variable refresh** -- dashboard variables that depend on label values need their
  refresh setting configured to "On time range change" or "On dashboard load" to
  stay current.
- **Memory on Pi** -- complex dashboards with many panels and short refresh intervals
  can consume significant memory. Keep panel count reasonable and use 30s+ refresh.

## See Also

- [service-monitoring](../service-monitoring/SKILL.md) -- broader monitoring stack overview
- [alerting-rules](../alerting-rules/SKILL.md) -- Prometheus alerting tied to dashboard metrics
- [pi-system-management](../pi-system-management/SKILL.md) -- hardware metrics feeding dashboards
