---
name: pi-system-management
description: Monitor and manage Raspberry Pi hardware - CPU temperature, throttling, memory, disk, and safe reboots.
tools:
  - homelab_piStatus
  - homelab_piReboot
  - homelab_diskUsage
standards-version: 1.6.3
---

# Pi System Management

Manage and monitor a Raspberry Pi 5 running as a home lab server. Covers hardware
health checks (CPU temperature, voltage throttling, memory pressure), disk usage
monitoring, and safe reboot procedures via SSH.

## Trigger

- User asks about Pi health, temperature, CPU stats, or throttling
- User wants to check memory or disk usage on the Pi
- User requests a reboot or shutdown of the Pi
- User mentions "vcgencmd", "thermal", "throttle", or "system status"
- User asks "is the Pi okay?" or "is the server overheating?"

## Required Inputs

- SSH connectivity to the Raspberry Pi (validated via `homelab_sshTest`)
- No additional credentials beyond what the MCP server already holds

Optional:
- Specific threshold values for temperature or disk alerts
- Target partition or mount point for disk checks

## Workflow

1. **Verify connectivity** -- call `homelab_sshTest` to confirm the Pi is reachable.
2. **Gather system status** -- call `homelab_piStatus` to retrieve CPU temperature,
   clock speed, voltage status, throttling flags, uptime, and load averages.
3. **Evaluate thermal health** -- parse `vcgencmd measure_temp` output and thermal
   zone readings. Flag if temperature exceeds 80C (throttling threshold on Pi 5)
   or 85C (critical).
4. **Check throttling flags** -- decode the `vcgencmd get_throttled` hex value:
   - Bit 0: under-voltage detected
   - Bit 1: arm frequency capped
   - Bit 2: currently throttled
   - Bit 3: soft temperature limit active
   - Bits 16-19: same flags but "has occurred since boot"
5. **Inspect memory** -- review free/available memory from `homelab_piStatus`.
   Flag if available memory drops below 256MB on a 8GB Pi.
6. **Check disk usage** -- call `homelab_diskUsage` for all mounted filesystems.
   Alert on partitions above 85% usage, especially `/` and `/opt/homelab`.
7. **Report findings** -- present a summary table with status indicators.
8. **Reboot if requested** -- call `homelab_piReboot` only when the user explicitly
   asks. Always confirm before executing. Warn that all Docker services will restart.

## Key References

- Raspberry Pi 5 thermal design: passive cooling above 60C, throttle at 80C, hard limit 85C
- `vcgencmd` commands: `measure_temp`, `get_throttled`, `measure_clock arm`, `measure_volts`
- Thermal zone path: `/sys/class/thermal/thermal_zone0/temp` (millidegrees)
- Docker data root: `/var/lib/docker` (watch for image/volume bloat)
- Compose stacks at `/opt/homelab/docker/` across 7 stack directories

## Example Interaction

**User:** "Check if my Pi is running hot"

**Assistant actions:**
1. Call `homelab_sshTest` -- confirm connectivity
2. Call `homelab_piStatus` -- retrieve hardware telemetry
3. Call `homelab_diskUsage` -- check storage while we are at it

**Response:**
> Pi 5 is at 62C under normal load (3.1 avg). No throttling flags set.
> Memory: 5.2GB of 8GB available. Disk: root at 41%, /opt/homelab at 58%.
> Everything looks healthy -- no action needed.

**User:** "Reboot the Pi"

**Assistant actions:**
1. Confirm with user that a reboot will interrupt all running services
2. Call `homelab_piReboot`

## MCP Usage

| Tool               | Purpose                                      |
|---------------------|----------------------------------------------|
| `homelab_sshTest`   | Validate SSH connectivity before operations  |
| `homelab_piStatus`  | Get CPU temp, throttle flags, memory, uptime |
| `homelab_diskUsage` | List disk usage per mount point              |
| `homelab_piReboot`  | Initiate a safe reboot via SSH               |

Always call `homelab_sshTest` before any other tool to avoid confusing connection
errors with actual system problems.

## Common Pitfalls

- **Reading throttle flags wrong** -- the hex value from `get_throttled` uses both
  current-state bits (0-3) and since-boot bits (16-19). A value of `0x50000` means
  throttling occurred in the past but is not active now.
- **Rebooting without warning** -- never call `homelab_piReboot` without explicit
  user confirmation. All 13+ Docker services will go down.
- **Ignoring swap pressure** -- the Pi may show "available" memory via buffers/cache
  but be swapping heavily. Check swap usage alongside free memory.
- **Disk usage on tmpfs** -- `/run`, `/dev/shm`, and other tmpfs mounts are not
  real disk. Focus on `/`, `/boot/firmware`, and `/opt/homelab`.
- **Stale status after reboot** -- after calling `homelab_piReboot`, wait at least
  60 seconds before calling `homelab_sshTest` to check if the Pi is back up.

## See Also

- `docker-compose-stacks` -- managing the services that run on this Pi
- `service-monitoring` -- Prometheus and Grafana for long-term hardware metrics
- `backup-recovery` -- ensuring data safety before risky operations like reboots
