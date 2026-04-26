---
name: ssh-management
description: Manage SSH keys, harden SSH configuration, set up tunnels, and troubleshoot connection issues.
tools:
  - homelab_sshTest
standards-version: 1.9.0
---

# SSH Management

## Trigger

Use this skill when the user wants to:
- Generate or rotate SSH keys for Pi access
- Harden sshd_config on the Raspberry Pi
- Set up SSH tunnels or port forwarding to home lab services
- Debug SSH connection failures or timeouts
- Configure SSH agent forwarding from Windows to the Pi
- Manage authorized_keys entries for multiple users or machines

## Required Inputs

- Target Pi hostname or IP (from `.env` or user-provided)
- SSH username (typically the non-root user configured during provisioning)
- For tunnel setup: local port, remote host, and remote port
- For key rotation: desired key type (ed25519 recommended) and passphrase preference

## Workflow

1. **Verify connectivity** -- call `homelab_sshTest` to confirm the Pi is reachable before making changes.
2. **Assess current config** -- call `homelab_piStatus` to check uptime, then inspect the current sshd_config state via `homelab_serviceLogs` for sshd or relevant systemd journal entries.
3. **Key generation** (if requested):
   - Generate an ed25519 key pair on the Windows host using `ssh-keygen -t ed25519 -C "homelab-<hostname>"`.
   - Copy the public key to the Pi's `~/.ssh/authorized_keys` using `ssh-copy-id` or manual append.
   - Verify key-based login works before disabling password auth.
4. **Harden sshd_config** (if requested):
   - Disable password authentication: `PasswordAuthentication no`
   - Disable root login: `PermitRootLogin no`
   - Restrict to key-only: `PubkeyAuthentication yes`
   - Set `MaxAuthTries 3` and `LoginGraceTime 30`
   - Limit allowed users: `AllowUsers <username>`
   - Restart sshd via `homelab_serviceRestart` with the sshd service name.
5. **Tunnel setup** (if requested):
   - Local forward: `ssh -L <localPort>:<remoteHost>:<remotePort> user@pi`
   - Remote forward: `ssh -R <remotePort>:localhost:<localPort> user@pi`
   - Dynamic SOCKS proxy: `ssh -D <port> user@pi`
   - For persistent tunnels, configure entries in `~/.ssh/config` with `ServerAliveInterval 60`.
6. **Agent forwarding**:
   - Enable `ForwardAgent yes` in the SSH config block for the Pi host.
   - Ensure `ssh-agent` is running on Windows (via OpenSSH Authentication Agent service).
   - Add the key with `ssh-add`.
7. **Validate** -- call `homelab_sshTest` again after changes to confirm nothing broke.

## Key References

- OpenSSH sshd_config man page: key directives for hardening
- SSH config file (`~/.ssh/config`) syntax for host aliases and tunnel definitions
- Windows OpenSSH client documentation for agent and key management
- Ansible `ansible.builtin.authorized_key` module for automating key deployment

## Example Interaction

**User**: "Harden SSH on my Pi -- disable password auth and set up an SSH config entry."

**Agent response**:

1. Call `homelab_sshTest` to verify the Pi is reachable.
2. Generate an ed25519 key if the user does not have one:
   ```powershell
   ssh-keygen -t ed25519 -C "homelab-pi5" -f "$HOME\.ssh\id_ed25519_homelab"
   ```
3. Copy the public key to the Pi's authorized_keys.
4. Update sshd_config on the Pi to disable password auth, disable root login, and restrict to the user's account.
5. Call `homelab_serviceRestart` for sshd.
6. Call `homelab_sshTest` to confirm key-based access works.
7. Create an SSH config entry on Windows:
   ```
   Host pi5
       HostName 192.168.1.100
       User matt
       IdentityFile ~/.ssh/id_ed25519_homelab
       ServerAliveInterval 60
       ServerAliveCountMax 3
   ```

## MCP Usage

| Tool | Purpose |
|------|---------|
| `homelab_sshTest` | Verify SSH connectivity before and after config changes |
| `homelab_piStatus` | Check Pi uptime and basic system state |
| `homelab_serviceRestart` | Restart sshd after config modifications |
| `homelab_serviceLogs` | Inspect sshd logs for auth failures or config errors |
| `homelab_networkInfo` | Verify the Pi's IP and network interfaces |

## Common Pitfalls

- **Locking yourself out** -- always verify key-based login works in a separate session before disabling password auth. Keep a backup access method (e.g., console via Cockpit or physical access).
- **Wrong permissions** -- `~/.ssh` must be 700, `authorized_keys` must be 600. sshd silently ignores keys with wrong permissions.
- **Agent forwarding security** -- only enable ForwardAgent for trusted hosts. A compromised Pi with agent forwarding can use your keys.
- **Firewall blocking** -- if UFW is active, ensure port 22 (or custom SSH port) is allowed before restarting sshd. Call `homelab_networkInfo` to check.
- **Windows line endings** -- if editing sshd_config or authorized_keys from Windows, ensure LF line endings, not CRLF.

## See Also

- `security-hardening` -- broader hardening including fail2ban and UFW integration with SSH
- `ansible-workflows` -- automate SSH key deployment across multiple nodes
- `troubleshooting` -- debug SSH connection failures and timeout issues
