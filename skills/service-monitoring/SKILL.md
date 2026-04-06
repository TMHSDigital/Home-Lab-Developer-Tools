---
name: service-monitoring
description: Set up and use Prometheus, Grafana, Uptime Kuma, and Alertmanager for home lab observability.
tools:
  - homelab_serviceHealth
  - homelab_serviceLogs
  - homelab_serviceRestart
  - homelab_prometheusQuery
  - homelab_uptimeKumaStatus
---

# Service Monitoring

Configure and operate the observability stack on a Raspberry Pi 5 home lab. Covers
Prometheus scrape configuration, Grafana dashboard management, Uptime Kuma endpoint
monitoring, Alertmanager routing, and ntfy push notifications for alerts.

## Trigger

- User asks about monitoring, metrics, dashboards, or alerts
- User wants to add a new scrape target to Prometheus
- User asks to create or modify a Grafana dashboard
- User wants to set up Uptime Kuma monitors for a service
- User mentions "Prometheus", "Grafana", "alert", "uptime", or "ntfy"
- User asks why they are not receiving notifications for outages
- User wants to check if all services are healthy

## Required Inputs

- SSH connectivity to the Raspberry Pi (validated via `homelab_sshTest`)
- For Grafana changes: Grafana API key or admin credentials (stored in MCP config)

Optional:
- Specific service or endpoint to monitor
- Alert threshold values (e.g., response time > 5s)
- Notification channel preferences (ntfy topic name)

## Workflow

1. **Verify connectivity** -- call `homelab_sshTest`.
2. **Check service health** -- call `homelab_serviceHealth` for the monitoring
   stack services: Prometheus (port 9090), Grafana (port 3000), Uptime Kuma
   (port 3001), and Alertmanager (port 9093).
3. **Diagnose issues** -- if any monitoring service is unhealthy, call
   `homelab_serviceLogs` to retrieve recent logs and identify the problem.
4. **For Prometheus configuration:**
   - Review scrape configs at `/opt/homelab/docker/monitoring/prometheus/prometheus.yml`
   - Validate targets are reachable from the Pi's network
   - After config changes, restart Prometheus via `homelab_serviceRestart`
   - Confirm targets are up via the Prometheus targets API
5. **For Grafana dashboards:**
   - Use the Grafana HTTP API to list, create, or update dashboards
   - Provision dashboards as JSON files in the Grafana provisioning directory
6. **For Uptime Kuma monitors:**
   - Access the Uptime Kuma web UI or API to add HTTP/TCP/ping monitors
   - Configure notification integrations (ntfy webhook)
7. **For alert rules:**
   - Define Prometheus alerting rules in the rules file
   - Configure Alertmanager receivers to route to ntfy
   - Test the alert pipeline by triggering a synthetic alert
8. **Verify the full pipeline** -- confirm that a test alert fires, routes through
   Alertmanager, and arrives as a push notification via ntfy.

## Key References

Monitoring stack services and ports:
- Prometheus: `http://pi:9090` -- metrics collection and alerting rules
- Grafana: `http://pi:3000` -- visualization dashboards
- Uptime Kuma: `http://pi:3001` -- uptime and endpoint monitoring
- Alertmanager: `http://pi:9093` -- alert routing and silencing
- node_exporter: `http://pi:9100/metrics` -- host-level metrics
- Ntfy: `http://pi:8080` -- push notification server

Config file locations:
```
/opt/homelab/docker/monitoring/
  prometheus/prometheus.yml       # Scrape configs and global settings
  prometheus/rules/alerts.yml     # Alerting rule definitions
  alertmanager/alertmanager.yml   # Receiver and route configuration
  grafana/provisioning/           # Dashboard and datasource provisioning
```

Default scrape targets:
- node_exporter (host metrics: CPU, memory, disk, network)
- Prometheus itself (self-monitoring)
- AdGuard Home (DNS query stats)
- Nginx Proxy Manager (proxy metrics if enabled)
- Speedtest Tracker (bandwidth metrics)

## Example Interaction

**User:** "Are all my services up?"

**Assistant actions:**
1. Call `homelab_sshTest`
2. Call `homelab_serviceHealth` for each known service
3. Compile results

**Response:**
> 14 of 15 services are healthy. Stirling PDF is returning HTTP 502 --
> likely a container crash. Checking logs...
> (calls `homelab_serviceLogs` for stirling-pdf)
> Stirling PDF OOM-killed 12 minutes ago. Recommend restarting with a
> memory limit increase.

**User:** "Add a Prometheus scrape target for my NAS at 192.168.1.50:9100"

**Assistant actions:**
1. Explain the needed change to `prometheus.yml` (add a new job)
2. Guide user through editing the scrape config
3. Call `homelab_serviceRestart` for Prometheus
4. Verify the new target appears as UP

## MCP Usage

| Tool                     | Purpose                                        |
|---------------------------|------------------------------------------------|
| `homelab_sshTest`         | Validate connectivity before checks            |
| `homelab_serviceHealth`   | Check health of individual services            |
| `homelab_serviceLogs`     | Retrieve logs for unhealthy services           |
| `homelab_serviceRestart`  | Restart a monitoring service after config edit |
| `homelab_composePs`       | List all containers in the monitoring stack    |
| `homelab_composeUp`       | Redeploy monitoring stack after changes        |
| `homelab_networkInfo`     | Verify network reachability of scrape targets  |

## Common Pitfalls

- **Prometheus reload vs restart** -- Prometheus supports hot-reload via `POST
  /-/reload` for config changes. A full container restart is heavier and causes a
  brief metrics gap. Prefer reload when possible.
- **Grafana provisioned dashboards are read-only** -- dashboards loaded from the
  provisioning directory cannot be edited in the UI. Make changes to the JSON file
  and restart Grafana, or save as a new dashboard.
- **Alertmanager grouping** -- alerts with the same group_by labels are batched
  into a single notification. If you want separate notifications per service,
  include the `service` label in group_by.
- **Ntfy topic permissions** -- if ntfy is configured with ACLs, the Alertmanager
  webhook must authenticate. Check that the ntfy user/token in alertmanager.yml
  matches the ntfy server config.
- **node_exporter on the host** -- node_exporter runs natively (not in Docker) to
  get accurate host metrics. If it appears down, check the systemd service, not
  Docker.
- **Scrape interval too aggressive** -- a 5-second scrape interval on a Pi with
  15+ targets will cause CPU load. Default to 15s or 30s intervals.
- **Dashboard time range** -- Grafana defaults to "Last 6 hours". If metrics appear
  missing, first check the time range selector before investigating Prometheus.

## See Also

- `pi-system-management` -- hardware metrics that feed into Prometheus
- `docker-compose-stacks` -- deploying and updating the monitoring stack
- `network-configuration` -- proxy setup for external access to Grafana
- `backup-recovery` -- backing up Prometheus data and Grafana dashboards
