---
name: alerting-rules
description: Write Prometheus alerting rules and configure Alertmanager routing for home lab notifications.
tools:
  - homelab_alertList
  - homelab_prometheusQuery
  - homelab_ntfySend
standards-version: 1.7.0
---

# Alerting Rules

Write, test, and manage Prometheus alerting rules and Alertmanager routing
configuration on a Raspberry Pi home lab. Covers rule syntax, alert grouping,
receiver setup, inhibition rules, and integration with ntfy for push notifications.

## Trigger

- User asks about creating or editing Prometheus alerts
- User wants notifications when a service goes down or a threshold is breached
- User mentions "alert", "alerting", "Alertmanager", "notification", or "firing"
- User asks why alerts are not firing or notifications are not arriving
- User wants to silence or inhibit specific alerts
- User asks about alert routing or grouping configuration

## Required Inputs

- SSH connectivity to the Raspberry Pi (validated via `homelab_sshTest`)
- Prometheus running on port 9090
- Alertmanager running on port 9093

Optional:
- Specific metric or condition to alert on
- Notification target (ntfy topic, email, webhook)
- Alert severity level (critical, warning, info)

## Workflow

1. **Verify connectivity** -- call `homelab_sshTest`.
2. **Check monitoring stack** -- call `homelab_serviceHealth` for Prometheus and
   Alertmanager containers.
3. **For creating a new alert rule:**
   - Verify the metric exists using `homelab_prometheusQuery`
   - Write the alerting rule in PromQL with appropriate `for` duration and labels
   - Add the rule to the Prometheus rules file
   - Reload Prometheus configuration
   - Verify the rule appears via `homelab_prometheusQuery` on `ALERTS`
4. **For configuring Alertmanager routing:**
   - Edit `alertmanager.yml` to add receivers and routes
   - Configure ntfy webhook receiver for push notifications
   - Reload Alertmanager
5. **For debugging alert delivery:**
   - Call `homelab_alertList` to check current alert states
   - Call `homelab_prometheusQuery` with the alert expression to verify it evaluates true
   - Check Alertmanager logs via `homelab_serviceLogs`
   - Verify ntfy is reachable and the topic exists
6. **Test the pipeline** -- trigger a synthetic alert and confirm notification delivery.

## Key References

Service endpoints:
- Prometheus: `http://pi:9090` -- rules UI at `/-/rules`
- Alertmanager: `http://pi:9093` -- alerts UI and API
- Ntfy: `http://pi:8080` -- push notification server

Config file locations:
```
/opt/homelab/docker/monitoring/
  prometheus/prometheus.yml          # Global config with rule_files reference
  prometheus/rules/alerts.yml        # Alerting rule definitions
  alertmanager/alertmanager.yml      # Receiver and route configuration
```

Alert rule syntax:
```yaml
groups:
  - name: homelab
    rules:
      - alert: HighCPUUsage
        expr: 100 - (avg by(instance) (irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High CPU usage on {{ $labels.instance }}"
          description: "CPU usage is above 80% for 5 minutes (current: {{ $value | printf \"%.1f\" }}%)"
```

Alertmanager ntfy receiver:
```yaml
receivers:
  - name: ntfy
    webhook_configs:
      - url: http://ntfy:8080/homelab-alerts
        send_resolved: true
```

## Example Interaction

**User:** "Set up an alert for when disk usage goes above 85%"

**Assistant actions:**
1. Verify the metric: call `homelab_prometheusQuery` with disk usage expression
2. Write the alerting rule YAML
3. Guide user to add it to the rules file
4. Restart Prometheus

**Response:**
> Add this rule to `/opt/homelab/docker/monitoring/prometheus/rules/alerts.yml`:
>
> ```yaml
> - alert: DiskSpaceLow
>   expr: (1 - node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}) * 100 > 85
>   for: 10m
>   labels:
>     severity: warning
>   annotations:
>     summary: "Disk usage above 85% on {{ $labels.instance }}"
> ```
>
> After adding, reload Prometheus config. The alert will fire after disk stays
> above 85% for 10 minutes.

**User:** "Why am I not getting notifications for my alerts?"

**Assistant actions:**
1. Call `homelab_alertList` to see current alerts
2. Call `homelab_serviceLogs` for Alertmanager
3. Check ntfy connectivity

## MCP Usage

| Tool                          | Purpose                                            |
|-------------------------------|-----------------------------------------------------|
| `homelab_sshTest`             | Validate connectivity before operations             |
| `homelab_prometheusQuery`     | Verify metrics exist and test alert expressions     |
| `homelab_alertList`           | Check current Alertmanager alert states              |
| `homelab_serviceHealth`       | Check Prometheus and Alertmanager health            |
| `homelab_serviceLogs`         | Debug alert delivery issues                         |
| `homelab_serviceRestart`      | Restart Prometheus/Alertmanager after config changes |

## Common Pitfalls

- **`for` duration too short** -- a `for: 0s` alert fires on every evaluation and
  can flood notifications. Use at least `for: 5m` for most conditions.
- **Prometheus reload vs restart** -- Prometheus supports `POST /-/reload` for config
  changes. A full restart causes a brief metrics gap. Prefer reload when possible.
- **Alertmanager group_wait** -- Alertmanager batches alerts by default (group_wait: 30s,
  group_interval: 5m). This means the first notification may be delayed. Adjust
  these values for time-sensitive alerts.
- **Ntfy topic permissions** -- if ntfy is configured with ACLs, the Alertmanager
  webhook must authenticate. Verify the ntfy user/token in alertmanager.yml matches.
- **Resolved notifications** -- `send_resolved: true` sends a follow-up when the alert
  clears. This is helpful but doubles notification volume.
- **Label cardinality** -- alerting rules that produce many distinct label combinations
  will create many individual alerts. Use aggregation (`avg by`, `sum by`) to reduce.
- **Testing alerts** -- use `promtool check rules alerts.yml` to validate syntax before
  reloading. Bad YAML will prevent Prometheus from starting.

## See Also

- [service-monitoring](../service-monitoring/SKILL.md) -- broader monitoring stack setup
- [grafana-dashboards](../grafana-dashboards/SKILL.md) -- visualizing the metrics that alerts watch
- [network-configuration](../network-configuration/SKILL.md) -- exposing Alertmanager via reverse proxy
