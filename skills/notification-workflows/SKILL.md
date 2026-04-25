---
name: notification-workflows
description: Ntfy setup, alert routing, and notification pipelines
tools:
  - homelab_ntfySend
  - homelab_ntfyTopics
  - homelab_alertList
standards-version: 1.7.0
---

# Notification Workflows

Guide the user through setting up and managing push notifications via Ntfy, including alert routing from Prometheus/Alertmanager and custom notification pipelines.

## Trigger

- User asks about notifications, alerts, or push messages for their home lab
- User wants to set up or configure Ntfy
- User mentions "ntfy", "notifications", "alerts", "push notifications", or "webhooks"
- User wants to send test notifications or debug notification delivery
- User asks about routing Prometheus alerts to their phone
- User wants to build automated notification pipelines

## Required Inputs

- SSH connectivity to the Raspberry Pi (validated via `homelab_sshTest`)
- Ntfy container running on the Pi

Optional:
- Alertmanager running (for Prometheus alert routing)
- Specific topic names for targeted operations
- Webhook URLs for external integrations

## Workflow

### Send Test Notification

1. Use `homelab_ntfySend` with a topic, message, and optional title/priority/tags.
2. Verify delivery by checking `homelab_ntfyTopics` for the topic.

### View Recent Notifications

1. Use `homelab_ntfyTopics` to list recent messages across topics or for a specific topic.
2. Adjust the `since` parameter to widen or narrow the time window.

### Alertmanager Integration

Configure Alertmanager to forward alerts to Ntfy:

1. Check current alerts with `homelab_alertList` to understand what's firing.
2. Add an Ntfy webhook receiver to `alertmanager.yml`:

```yaml
receivers:
  - name: ntfy
    webhook_configs:
      - url: 'http://ntfy:8080/alerts'
        send_resolved: true
```

3. Route specific alerts to the Ntfy receiver:

```yaml
route:
  receiver: default
  routes:
    - match:
        severity: critical
      receiver: ntfy
```

4. Test by sending a notification: `homelab_ntfySend` with topic "alerts".

### Custom Notification Pipelines

Build notifications triggered by system events:

1. Backup completion: add `homelab_ntfySend` call after `homelab_backupRun`
2. Container restart: monitor with `homelab_serviceHealth` and notify on state changes
3. Disk space warnings: check `homelab_diskUsage` and notify when thresholds are crossed
4. Security events: monitor `homelab_fail2banStatus` for new bans and notify

### Topic Organization

Recommended topic structure:
- `alerts` -- Prometheus/Alertmanager critical alerts
- `backups` -- backup success/failure notifications
- `updates` -- system update availability
- `security` -- fail2ban bans, port scan detections
- `health` -- container health status changes

## Key References

- Ntfy documentation: https://docs.ntfy.sh
- Ntfy priority levels: min, low, default, high, urgent
- Alertmanager webhook_config documentation
- Ntfy topic subscription: install the Ntfy app and subscribe to your server's topics

## Example Interaction

**User:** I want to get notified on my phone when a backup fails.

**Assistant:**

1. First, let me verify Ntfy is running by checking for recent messages.

   *Calls `homelab_ntfyTopics` with since "24h"*

   Ntfy is running with 3 topics active. Let me send a test notification to a "backups" topic.

2. Sending a test notification.

   *Calls `homelab_ntfySend` with topic "backups", message "Test backup notification", title "Backup Status", priority "default", tags "floppy_disk"*

   Notification sent. Check your Ntfy app -- you should see it on the "backups" topic.

3. To automate this, add a post-backup script on the Pi that calls Ntfy on failure:

   ```bash
   restic backup /opt/homelab || curl -d "Backup failed at $(date)" -H "Priority: high" -H "Tags: warning" http://localhost:8080/backups
   ```

   Or modify your systemd backup timer to include an `OnFailure=` unit that sends the notification.

## MCP Usage

- `homelab_ntfySend` -- send notifications with topic, message, title, priority, and tags
- `homelab_ntfyTopics` -- list recent messages on a topic to verify delivery or review history
- `homelab_alertList` -- check Alertmanager alerts to understand what should be routed to Ntfy

## Common Pitfalls

- Ntfy topics are created on first publish -- no need to pre-create them
- The default Ntfy port is 8080, which may conflict with other services; set `HOMELAB_NTFY_PORT` if remapped
- Ntfy messages are cached for 12 hours by default; adjust `cache-duration` in the Ntfy config for longer retention
- When using Alertmanager webhooks, ensure the Ntfy container is on the same Docker network as Alertmanager
- High-priority notifications bypass Do Not Disturb on most phones -- use sparingly

## See Also

- `alerting-rules` skill for Prometheus alerting rule configuration
- `service-monitoring` skill for monitoring stack setup
- `log-analysis` skill for investigating issues that trigger alerts
