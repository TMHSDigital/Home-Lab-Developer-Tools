---
name: log-analysis
description: Structured log querying, journald workflows, and container log searching
tools:
  - homelab_journalLogs
  - homelab_logSearch
  - homelab_serviceLogs
standards-version: 1.9.0
---

# Log Analysis

Guide the user through querying and analyzing logs from systemd journal and Docker containers on their Raspberry Pi home lab.

## Trigger

- User asks about system logs, journald, or syslog on their Pi
- User wants to search Docker container logs for errors or patterns
- User mentions "logs", "journalctl", "log search", "error logs", or "debug logs"
- User wants to correlate events across multiple services
- User asks why a service crashed or restarted
- User wants to filter logs by priority, time range, or unit

## Required Inputs

- SSH connectivity to the Raspberry Pi (validated via `homelab_sshTest`)

Optional:
- Systemd unit name for targeted journal queries
- Container name for targeted Docker log searches
- Grep pattern or keywords to search for
- Time range to narrow results

## Workflow

### System Log Investigation

1. Start with `homelab_journalLogs` to query the systemd journal.
2. Filter by unit (e.g. `docker.service`, `ssh.service`) to isolate a specific service.
3. Use priority filtering (0=emergency through 7=debug) to focus on errors first.
4. Narrow with `since` to a specific time window when the issue occurred.

### Container Log Search

1. Use `homelab_logSearch` with a grep pattern to find matching log lines across all containers.
2. If you know the container, pass `service` to limit the search scope.
3. Use `homelab_serviceLogs` to get the full recent log tail of a specific container for context.

### Crash Investigation

1. Check journal for the crashed unit: `homelab_journalLogs` with `unit` and `priority: 3` (error level).
2. Search container logs for OOM kills or fatal errors: `homelab_logSearch` with pattern `OOM|killed|fatal|panic`.
3. Check system-level events around the same time: `homelab_journalLogs` with `since` set to just before the crash.

### Log Correlation

1. Identify the time window of interest from an initial query.
2. Query journal and container logs for the same window.
3. Look for cascading failures -- one service going down causing others to fail.

## Key References

- `journalctl` man page for time specification formats
- Docker logging drivers documentation
- Syslog priority levels: 0=emerg, 1=alert, 2=crit, 3=err, 4=warning, 5=notice, 6=info, 7=debug

## Example Interaction

**User:** My Grafana container keeps restarting. What's going on?

**Assistant:**

1. Let me check the recent Docker logs for Grafana.

   *Calls `homelab_serviceLogs` with service "grafana", lines 100*

   The last 100 lines show Grafana starting up and then exiting with "out of memory". Let me check the system journal for OOM events.

2. Let me search for OOM kill events in the system journal.

   *Calls `homelab_journalLogs` with priority 3, since "2 hours ago"*

   Found an OOM killer entry at 14:23 targeting the Grafana process. Your Pi ran out of memory.

3. Let me check if other containers are also affected.

   *Calls `homelab_logSearch` with pattern "OOM|killed|restart"*

   Only Grafana was hit. Recommendations:
   - Add a memory limit to the Grafana container in your compose file
   - Check Grafana dashboard count -- too many dashboards with auto-refresh can spike memory
   - Consider adding swap if not already configured

## MCP Usage

- `homelab_journalLogs` -- primary tool for systemd/OS-level log queries with unit, priority, time, and line count filters
- `homelab_logSearch` -- search across one or all container logs with grep patterns
- `homelab_serviceLogs` -- get the raw recent log tail from a specific container

## Common Pitfalls

- Journal entries rotate; very old logs may not be available depending on journald retention settings
- Container log drivers other than `json-file` or `journald` may not support `docker logs`
- Grep patterns with special characters need proper escaping
- Searching all containers at once can be slow with many running containers

## See Also

- `troubleshooting` skill for broader debugging workflows
- `service-monitoring` skill for Prometheus/Grafana-based monitoring
- `docker-compose-stacks` skill for container management
