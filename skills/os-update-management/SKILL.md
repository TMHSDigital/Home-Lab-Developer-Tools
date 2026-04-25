---
name: os-update-management
description: Unattended-upgrades config, kernel updates, reboot scheduling
tools:
  - homelab_aptUpdate
  - homelab_aptUpgradable
  - homelab_aptHistory
  - homelab_kernelInfo
  - homelab_systemdServices
standards-version: 1.9.0
---

# OS Update Management

Guide the user through managing operating system updates on their Raspberry Pi, including package updates, kernel upgrades, unattended-upgrades configuration, and scheduled reboot planning.

## Trigger

- User asks about updating their Pi's OS or packages
- User wants to check for available updates without applying them
- User asks about unattended-upgrades or automatic updates
- User mentions "apt upgrade", "kernel update", "reboot schedule", or "package management"
- User wants to review what was recently installed or upgraded
- User asks about update policies or scheduling maintenance windows

## Required Inputs

- SSH connectivity to the Raspberry Pi (validated via `homelab_sshTest`)

Optional:
- Whether to actually apply upgrades (vs just listing)
- Specific packages to investigate
- Desired unattended-upgrades configuration

## Workflow

### Check Current Update Status

1. Run `homelab_aptUpgradable` to see what packages have updates available.
2. If the list is stale, run `homelab_aptUpdate` to refresh the package index first.
3. Review the list -- security updates should be prioritized.

### Review Update History

1. Run `homelab_aptHistory` to see recent package operations.
2. Look for patterns -- frequent updates to the same package may indicate instability.
3. Check if security updates are being applied in a timely manner.

### Apply Updates

1. Run `homelab_aptUpgradable` to review pending updates.
2. Run `homelab_aptUpdate` with `upgrade: true` to apply all pending updates.
3. Run `homelab_kernelInfo` to check if a kernel update requires a reboot.
4. If reboot needed, check running services with `homelab_systemdServices` before scheduling.

### Configure Unattended Upgrades

1. Check if unattended-upgrades is installed and running:
   - `homelab_systemdServices` with `unit: "unattended-upgrades.service"`
2. Review the configuration files:
   - `/etc/apt/apt.conf.d/50unattended-upgrades` -- which packages to auto-update
   - `/etc/apt/apt.conf.d/20auto-upgrades` -- update frequency
3. Recommended settings for a home lab Pi:

```
Unattended-Upgrade::Origins-Pattern {
    "origin=Debian,codename=${distro_codename},label=Debian-Security";
    "origin=Raspbian,codename=${distro_codename}";
};
Unattended-Upgrade::Automatic-Reboot "false";
Unattended-Upgrade::Mail "root";
```

### Schedule Maintenance Reboots

1. Check if a reboot is pending: look for `/var/run/reboot-required`
2. Check `homelab_kernelInfo` -- if running kernel differs from installed, reboot is needed
3. Use `homelab_systemdServices` with `type: "timer"` to review existing timers
4. Create a systemd timer for scheduled reboots during low-traffic hours

## Key References

- `apt` and `apt-get` man pages
- `unattended-upgrades` documentation
- Raspberry Pi OS release notes for kernel updates
- `/var/log/apt/history.log` for package operation history
- `/var/run/reboot-required` for pending reboot detection

## Example Interaction

**User:** Are there any updates available for my Pi?

**Assistant:**

1. Let me check for upgradable packages.

   *Calls `homelab_aptUpgradable`*

   There are 12 packages with updates available, including 3 security updates for openssl, libssl3, and openssh-server.

2. Let me check when packages were last updated.

   *Calls `homelab_aptHistory` with lines 20*

   Last update was 5 days ago. The security updates should be applied soon.

3. Let me check the kernel version too.

   *Calls `homelab_kernelInfo`*

   Running kernel 6.6.31 -- this matches the installed version, so no kernel update pending.

   Recommendations:
   - Apply the 3 security updates immediately with `homelab_aptUpdate` (upgrade: true)
   - The remaining 9 packages can wait for your next maintenance window
   - Consider enabling unattended-upgrades for security patches

## MCP Usage

- `homelab_aptUpgradable` -- check available updates without modifying the system
- `homelab_aptUpdate` -- refresh package index and optionally apply upgrades
- `homelab_aptHistory` -- review recent install/upgrade/remove operations
- `homelab_kernelInfo` -- check running vs installed kernel to determine reboot need
- `homelab_systemdServices` -- check unattended-upgrades status or review timers

## Common Pitfalls

- Running `apt upgrade` on a Pi with limited disk can fail mid-upgrade -- check disk space first with `homelab_diskUsage`
- Kernel updates on Raspberry Pi OS require a reboot to take effect
- Unattended-upgrades can restart services unexpectedly -- disable auto-reboot for home lab
- The apt history log rotates -- older entries are in gzipped files
- Running containers may need restarting after library updates (especially libssl)

## See Also

- `pi-system-management` skill for hardware monitoring
- `performance-tuning` skill for kernel parameter optimization
- `docker-compose-stacks` skill for restarting services after updates
- `notification-workflows` skill for alerting on update availability
