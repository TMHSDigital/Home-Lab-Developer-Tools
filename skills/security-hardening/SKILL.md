---
name: security-hardening
description: Harden the home lab with UFW firewall rules, fail2ban, SSH lockdown, and container security practices.
tools:
  - homelab_ufwStatus
  - homelab_fail2banStatus
  - homelab_openPorts
  - homelab_containerScan
standards-version: 1.9.0
---

# Security Hardening

## Trigger

Use this skill when the user wants to:
- Configure or modify UFW firewall rules on the Pi
- Set up or tune fail2ban jails for SSH, Nginx, or other services
- Lock down SSH to key-only authentication
- Harden Docker containers (non-root users, read-only filesystems, capability dropping)
- Secure Vaultwarden, Nginx Proxy Manager, or other exposed services
- Protect the Docker socket from unauthorized access
- Audit the current security posture of the home lab

## Required Inputs

- Target Pi hostname or IP
- Which services are externally exposed (if any)
- Whether a reverse proxy (Nginx Proxy Manager) is in front of services
- Current firewall state (or willingness to enable UFW)

## Workflow

1. **Assess current state** -- call `homelab_piStatus` for system overview, `homelab_networkInfo` for open ports and interfaces, and `homelab_sshTest` to verify connectivity.
2. **UFW firewall setup**:
   - Enable UFW with default deny incoming: `sudo ufw default deny incoming`
   - Allow SSH: `sudo ufw allow 22/tcp`
   - Allow necessary service ports through the reverse proxy only (typically 80, 443):
     ```
     sudo ufw allow 80/tcp
     sudo ufw allow 443/tcp
     ```
   - Allow local network access to internal services:
     ```
     sudo ufw allow from 192.168.1.0/24 to any port 9090 proto tcp  # Cockpit
     sudo ufw allow from 192.168.1.0/24 to any port 9000 proto tcp  # Portainer
     ```
   - Enable UFW: `sudo ufw enable`
   - Verify with `sudo ufw status verbose`.
3. **fail2ban configuration**:
   - Install fail2ban: `sudo apt install fail2ban`
   - Create `/etc/fail2ban/jail.local` with:
     ```ini
     [sshd]
     enabled = true
     port = ssh
     filter = sshd
     logpath = /var/log/auth.log
     maxretry = 3
     bantime = 3600
     findtime = 600

     [nginx-proxy-manager]
     enabled = true
     port = http,https
     filter = npm
     logpath = /opt/homelab/docker/nginx-proxy-manager/data/logs/fallback_access.log
     maxretry = 5
     bantime = 3600
     ```
   - Restart fail2ban via `homelab_serviceRestart`.
4. **SSH lockdown**:
   - Disable password auth, disable root login, restrict users (see `ssh-management` skill for detailed steps).
   - Call `homelab_serviceRestart` for sshd after changes.
5. **Container security**:
   - Run containers as non-root where possible -- set `user: "1000:1000"` in compose files.
   - Use read-only root filesystems: `read_only: true` with explicit tmpfs mounts for writable paths.
   - Drop all capabilities and add only what is needed:
     ```yaml
     cap_drop:
       - ALL
     cap_add:
       - NET_BIND_SERVICE
     ```
   - Limit container resources with `mem_limit` and `cpus`.
6. **Docker socket protection**:
   - Never expose the Docker socket to the internet.
   - For Portainer, use a socket proxy like `tecnativa/docker-socket-proxy` instead of mounting `/var/run/docker.sock` directly.
   - Set `GRANT_SUDO=false` for Code Server.
7. **Vaultwarden hardening**:
   - Disable new user signups: `SIGNUPS_ALLOWED=false`
   - Enable admin token with a strong value: `ADMIN_TOKEN=<argon2-hash>`
   - Restrict admin panel access to local network via Nginx Proxy Manager rules.
   - Enable 2FA enforcement for all users.
8. **Validate** -- call `homelab_serviceHealth` to confirm all services are still running after hardening. Call `homelab_networkInfo` to verify firewall state.

## Key References

- UFW documentation and rule syntax
- fail2ban jail configuration and filter writing
- Docker Compose security options: `cap_drop`, `read_only`, `user`, `security_opt`
- Vaultwarden environment variables for security configuration
- Nginx Proxy Manager access lists and proxy host settings
- CIS benchmarks for Debian/Raspberry Pi OS

## Example Interaction

**User**: "Set up UFW on my Pi and configure fail2ban for SSH."

**Agent response**:

1. Call `homelab_sshTest` to confirm connectivity.
2. Call `homelab_networkInfo` to identify current open ports.
3. Guide UFW setup:
   ```bash
   sudo ufw default deny incoming
   sudo ufw default allow outgoing
   sudo ufw allow 22/tcp
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw allow from 192.168.1.0/24 to any port 9090 proto tcp
   sudo ufw enable
   ```
4. Install and configure fail2ban for SSH with maxretry=3, bantime=3600.
5. Call `homelab_serviceHealth` to verify services remain accessible.
6. Call `homelab_piStatus` for a final system check.

## MCP Usage

| Tool | Purpose |
|------|---------|
| `homelab_sshTest` | Verify SSH access before and after lockdown changes |
| `homelab_piStatus` | System overview before hardening |
| `homelab_networkInfo` | Inspect open ports, interfaces, and firewall state |
| `homelab_serviceHealth` | Confirm services survive firewall and config changes |
| `homelab_serviceRestart` | Restart fail2ban, sshd, or nginx after config updates |
| `homelab_serviceLogs` | Check fail2ban logs for ban activity or errors |
| `homelab_composePs` | Verify container state after security changes |
| `homelab_composeUp` | Redeploy stacks with updated security options |

## Common Pitfalls

- **Locking yourself out with UFW** -- always allow SSH (port 22) before enabling UFW. Have a fallback access method such as Cockpit on the local network or physical console.
- **fail2ban banning your own IP** -- whitelist your workstation IP in `jail.local` with `ignoreip = 127.0.0.1/8 192.168.1.0/24`.
- **Breaking containers with read_only** -- some containers write to unexpected paths. Test with `read_only: true` and add tmpfs mounts for paths that fail.
- **Docker socket exposure** -- mounting `/var/run/docker.sock` gives a container full root access to the host. Use a socket proxy with limited API access.
- **UFW and Docker conflict** -- Docker modifies iptables directly, bypassing UFW. Install `ufw-docker` or use `DOCKER_IPTABLES=false` and manage rules manually.
- **Forgetting to persist rules** -- UFW rules persist by default, but fail2ban bans are temporary. Ensure `bantime` and `findtime` match your threat model.

## See Also

- `ssh-management` -- detailed SSH key and sshd_config hardening
- `ansible-workflows` -- automate security hardening across multiple nodes
- `network-configuration` -- network-level security and VLAN isolation
- `troubleshooting` -- debug connectivity issues after hardening
