---
name: troubleshooting
description: Debug container crashes, network connectivity issues, Pi hardware problems, and service failures.
tools:
  - homelab_serviceLogs
  - homelab_serviceHealth
  - homelab_piStatus
  - homelab_journalLogs
  - homelab_logSearch
  - homelab_healthCheck
  - homelab_diagnostics
---

# Troubleshooting

## Trigger

Use this skill when the user wants to:
- Diagnose why a Docker container is crashing or restarting
- Debug network connectivity between services or from external clients
- Investigate Raspberry Pi hardware issues (throttling, overheating, undervoltage)
- Troubleshoot systemd service failures (Cockpit, Samba, node_exporter)
- Resolve DNS issues with AdGuard Home
- Debug reverse proxy errors in Nginx Proxy Manager
- Investigate general "service is down" reports from Uptime Kuma or Homepage

## Required Inputs

- Symptom description -- what is broken, when it started, any recent changes
- Affected service name(s) or container name(s)
- Whether the issue is intermittent or persistent

## Workflow

1. **Triage** -- determine the scope of the problem:
   - Single container? Call `homelab_serviceLogs` for that service and `homelab_composePs` for container state.
   - All services down? Call `homelab_piStatus` to check if the Pi itself is healthy.
   - Network issue? Call `homelab_networkInfo` to inspect interfaces, routes, and DNS.
   - Call `homelab_sshTest` first -- if SSH is unreachable, the Pi may be offline or network is down.
2. **Container crash debugging**:
   - Check container status with `homelab_composePs` -- look for `Restarting`, `Exited`, or `unhealthy`.
   - Pull logs with `homelab_serviceLogs` for the specific container.
   - Common crash causes:
     - **OOM killed** -- check `docker inspect <container> | grep OOMKilled` and increase `mem_limit` in compose.
     - **Config error** -- bad environment variable or missing volume mount. Check compose file against service docs.
     - **Port conflict** -- another service or host process is using the same port. Check with `ss -tlnp`.
     - **Corrupt data** -- volume data corruption. Try removing the volume and redeploying (after backup).
   - Restart the container: call `homelab_serviceRestart` or `homelab_composeUp` to recreate.
3. **Network debugging**:
   - Call `homelab_networkInfo` for interface status, IP addresses, and routing.
   - DNS resolution: check if AdGuard Home is running via `homelab_serviceHealth`. Test resolution with `dig @localhost <domain>`.
   - Inter-container networking: containers on the same Docker network should resolve each other by service name. Check the compose network configuration.
   - External access through Nginx Proxy Manager: verify proxy host config, SSL certificate status, and upstream target.
   - Firewall: if UFW is enabled, check that required ports are allowed. See `security-hardening` skill.
4. **Pi hardware issues**:
   - Call `homelab_piStatus` -- look for throttling flags.
   - Check for undervoltage: `vcgencmd get_throttled` -- a non-zero value indicates power issues.
     - `0x50005` = currently under-voltage and was throttled.
     - Solution: use the official Pi 5 27W USB-C power supply.
   - Check temperature: `vcgencmd measure_temp` -- throttling starts at 80C, hard limit at 85C.
     - Solution: ensure the active cooler or heatsink is properly mounted and fan is running.
   - Check CPU frequency: `vcgencmd measure_clock arm` -- reduced frequency indicates throttling.
5. **Systemd service failures**:
   - Check service status: `systemctl status <service>`
   - View journal: `journalctl -u <service> --no-pager -n 50`
   - Common failures:
     - **Cockpit**: check `cockpit.socket` is enabled, port 9090 is not blocked.
     - **Samba**: config syntax error in smb.conf. Test with `testparm`.
     - **node_exporter**: port 9100 conflict or service disabled after update.
   - Restart: call `homelab_serviceRestart` for the failed service.
6. **Compose stack issues**:
   - Pull latest images: call `homelab_composePull` to check for updates.
   - Recreate containers: call `homelab_composeDown` then `homelab_composeUp`.
   - Check for image pull failures due to rate limiting or network issues.
7. **Validate resolution** -- after applying fixes:
   - Call `homelab_serviceHealth` to confirm the affected service is healthy.
   - Call `homelab_piStatus` for overall system health.
   - If applicable, call `homelab_networkInfo` to verify network state.

## Key References

- Docker logs: `docker logs <container> --tail 100 -f`
- Docker inspect: `docker inspect <container>` for full container config and state
- Pi throttling: `vcgencmd get_throttled` flag interpretation
- Systemd journal: `journalctl -u <service> --since "1 hour ago"`
- Compose stacks: `/opt/homelab/docker/<service>/docker-compose.yml`
- Uptime Kuma dashboard for historical uptime data

## Example Interaction

**User**: "Grafana keeps restarting on my Pi."

**Agent response**:

1. Call `homelab_composePs` to confirm Grafana's state -- expect `Restarting` or `Exited`.
2. Call `homelab_serviceLogs` for Grafana to find the error:
   - If OOM: increase `mem_limit` in `/opt/homelab/docker/grafana/docker-compose.yml`.
   - If permission error: check that the Grafana data volume has correct ownership (UID 472).
   - If config error: validate `grafana.ini` or environment variables.
3. Call `homelab_piStatus` to check for Pi-level resource exhaustion or throttling.
4. Apply the fix (e.g., fix volume permissions):
   ```bash
   sudo chown -R 472:472 /opt/homelab/docker/grafana/data
   ```
5. Call `homelab_composeUp` to redeploy Grafana.
6. Call `homelab_serviceHealth` to confirm Grafana is now healthy.
7. Verify in the browser or call `homelab_serviceLogs` again to see clean startup logs.

## MCP Usage

| Tool | Purpose |
|------|---------|
| `homelab_sshTest` | First check -- is the Pi even reachable? |
| `homelab_piStatus` | System health, CPU, memory, throttling indicators |
| `homelab_serviceHealth` | Check if specific services are up or down |
| `homelab_serviceLogs` | Pull container or service logs for error messages |
| `homelab_serviceRestart` | Restart a failed service or container |
| `homelab_composePs` | Container state for a compose stack |
| `homelab_composeUp` | Recreate containers after config fixes |
| `homelab_composeDown` | Stop a stack cleanly before redeployment |
| `homelab_composePull` | Pull latest images to fix known bugs |
| `homelab_networkInfo` | Inspect network interfaces, routes, DNS |
| `homelab_diskUsage` | Check if disk full is causing failures |
| `homelab_aptUpdate` | Check for system package updates that fix bugs |

## Common Pitfalls

- **Reading only the last few log lines** -- some errors are logged at startup, not at the crash. Always pull enough log history to see the initial error.
- **Restarting without diagnosing** -- blindly restarting a crashing container just resets the restart counter. Find the root cause in logs first.
- **Ignoring Pi throttling** -- performance degradation and random service failures can be caused by undervoltage or overheating. Always check `homelab_piStatus` for hardware issues.
- **DNS loops with AdGuard Home** -- if the Pi uses itself as DNS and AdGuard Home is down, nothing resolves. Set a fallback DNS in `/etc/resolv.conf` or `dhcpcd.conf`.
- **Docker network isolation** -- containers on different Docker networks cannot communicate by default. Check that dependent services share a network in their compose files.
- **Stale images** -- old images may have known bugs. Call `homelab_composePull` before deep debugging to rule out already-fixed issues.
- **Filesystem corruption on SD card** -- sudden power loss can corrupt the filesystem. Run `fsck` from a recovery boot if the Pi fails to start cleanly.

## See Also

- `pi-system-management` -- Pi health monitoring and system-level commands
- `docker-compose-stacks` -- compose file structure and common configuration issues
- `network-configuration` -- network setup and DNS configuration
- `service-monitoring` -- Prometheus, Grafana, and Uptime Kuma for proactive monitoring
- `storage-management` -- disk-full issues and cleanup strategies
