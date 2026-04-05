---
name: performance-tuning
description: Kernel params, swap config, I/O scheduler, GPU memory split
tools:
  - homelab_kernelInfo
  - homelab_piStatus
  - homelab_systemdServices
---

# Performance Tuning

Guide the user through optimizing their Raspberry Pi's performance for home lab workloads, covering kernel parameters, swap configuration, I/O scheduling, GPU memory allocation, and resource monitoring.

## Trigger

- User asks about improving Pi performance or reducing latency
- User mentions "slow", "swap", "memory", "GPU memory split", or "I/O scheduler"
- User wants to optimize their Pi for Docker workloads
- User asks about kernel parameters, sysctl tuning, or boot config
- User wants to reduce SD card wear or optimize storage I/O
- User asks about CPU governor, overclocking, or thermal management

## Required Inputs

- SSH connectivity to the Raspberry Pi (validated via `homelab_sshTest`)

Optional:
- Current workload description (container-heavy, NAS, monitoring, etc.)
- Whether the Pi uses an SD card, USB SSD, or NVMe
- Amount of RAM (4GB vs 8GB)

## Workflow

### Baseline Assessment

1. Run `homelab_piStatus` to check CPU temp, memory usage, and throttle state.
2. Run `homelab_kernelInfo` to see current kernel version and boot parameters.
3. Check swap configuration: look for `zram` or `dphys-swapfile` in boot params and loaded modules.

### Memory Optimization

1. **GPU memory split**: For headless home lab servers, reduce GPU memory to minimum:
   - Edit `/boot/firmware/config.txt`: `gpu_mem=16`
   - This frees up to 60MB of RAM for applications
2. **Swap tuning**: Reduce swappiness for SSD, increase for SD card:
   - SSD: `vm.swappiness=10` in `/etc/sysctl.d/99-tuning.conf`
   - SD card: `vm.swappiness=1` (minimize writes)
3. **zram**: Enable compressed swap in RAM for better performance than disk swap:

```bash
sudo apt install zram-tools
echo 'ALGO=zstd' | sudo tee /etc/default/zramswap
echo 'PERCENT=50' | sudo tee -a /etc/default/zramswap
sudo systemctl restart zramswap
```

### I/O Optimization

1. Check current scheduler: `cat /sys/block/mmcblk0/queue/scheduler` (or `sda` for USB)
2. For SD cards: `mq-deadline` is optimal
3. For SSDs/NVMe: `none` (noop) is optimal
4. Set via udev rule for persistence:

```bash
echo 'ACTION=="add|change", KERNEL=="mmcblk*", ATTR{queue/scheduler}="mq-deadline"' | \
  sudo tee /etc/udev/rules.d/60-scheduler.rules
```

5. Reduce journal writes: `Storage=volatile` in `/etc/systemd/journald.conf`

### CPU and Thermal

1. Check current governor: `cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor`
2. For consistent performance: `performance` governor (at cost of more heat)
3. For balanced: `schedutil` (default, scales with load)
4. Check if throttling is occurring via `homelab_piStatus` -- if yes, improve cooling before overclocking

### Docker-Specific Tuning

1. Increase max file watchers for containers:
   - `fs.inotify.max_user_watches=524288` in sysctl
   - `fs.inotify.max_user_instances=512`
2. Increase ARP cache for many containers:
   - `net.ipv4.neigh.default.gc_thresh3=4096`
3. Check Docker storage driver: `overlay2` is optimal
4. Use `homelab_systemdServices` with `unit: "docker.service"` to verify Docker health

## Key References

- Raspberry Pi documentation: performance and config.txt
- `/boot/firmware/config.txt` for boot-time hardware config
- `/etc/sysctl.d/` for kernel runtime parameters
- `vcgencmd` commands for Pi-specific hardware info
- Linux kernel documentation for scheduler and VM tuning

## Example Interaction

**User:** My Pi feels sluggish when running all 13 containers. How can I optimize it?

**Assistant:**

1. Let me check the current system state.

   *Calls `homelab_piStatus`*

   CPU temp is 62C (fine), memory is 7.2GB/8GB used (very high), no throttling. Memory pressure is the bottleneck.

2. Let me check the kernel config.

   *Calls `homelab_kernelInfo`*

   GPU memory is set to 76MB (default). Boot params show `dphys-swapfile` active with 200MB swap. Let me check systemd for zram.

3. Let me check swap and Docker status.

   *Calls `homelab_systemdServices` with unit "zramswap.service"*

   zram is not installed. Here's what I recommend:

   - Reduce GPU memory from 76MB to 16MB (frees 60MB): edit `/boot/firmware/config.txt`
   - Install zram for compressed swap in RAM -- much faster than SD card swap
   - Set `vm.swappiness=10` to keep more data in RAM
   - Increase inotify watches for Docker: `fs.inotify.max_user_watches=524288`
   - Consider which containers can be stopped during low-usage hours

## MCP Usage

- `homelab_kernelInfo` -- check kernel version, boot params, and loaded modules to identify tuning opportunities
- `homelab_piStatus` -- monitor CPU temp, memory, disk, and throttle state to find bottlenecks
- `homelab_systemdServices` -- check service status (Docker, zram, swap) and timer configurations

## Common Pitfalls

- Overclocking without adequate cooling causes thermal throttling, making performance worse
- Setting `gpu_mem=16` breaks any GUI/display output -- only do this on headless servers
- SD card swap is extremely slow and wears the card -- prefer zram or USB SSD swap
- Changing the I/O scheduler requires a reboot (or udev trigger) to take effect
- Some kernel parameters in `config.txt` only apply after a reboot
- Aggressive swappiness reduction can cause OOM kills under memory pressure

## See Also

- `pi-system-management` skill for hardware monitoring and reboot management
- `os-update-management` skill for kernel updates that may improve performance
- `docker-compose-stacks` skill for managing container resource allocation
- `storage-management` skill for disk I/O and volume management
