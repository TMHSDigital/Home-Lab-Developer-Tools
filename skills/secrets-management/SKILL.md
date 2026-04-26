---
name: secrets-management
description: Managing credentials with Vaultwarden, environment variables, Docker secrets, and security auditing
tools:
  - homelab_containerScan
  - homelab_ufwStatus
  - homelab_fail2banStatus
  - homelab_openPorts
standards-version: 1.9.0
---

# Secrets Management

Guide the user through secure credential management in a home lab environment, covering Vaultwarden password management, Docker secrets, environment variable hygiene, and security auditing.

## Trigger

- User asks about managing passwords, API keys, or credentials in their home lab
- User wants to set up or configure Vaultwarden
- User asks about Docker secrets vs environment variables
- User mentions "secrets", "credentials", "passwords", "API keys", or "Vaultwarden"
- User wants to audit their setup for hardcoded or weak credentials
- User asks about securing environment variables in Docker Compose
- User wants to rotate credentials or tokens

## Required Inputs

- SSH connectivity to the Raspberry Pi (validated via `homelab_sshTest`)
- Docker running on the Pi

Optional:
- Vaultwarden container running (for password vault workflows)
- Trivy installed (for container vulnerability scanning)
- Specific service or compose file to audit

## Workflow

### Credential Audit

1. Run `homelab_openPorts` to identify all listening services and check for unexpected exposed ports.
2. Run `homelab_ufwStatus` to verify firewall rules are properly restricting access.
3. Run `homelab_containerScan` to check running containers for known vulnerabilities.
4. Review compose files for hardcoded credentials in `environment:` blocks.

### Docker Secrets Setup

For services that support Docker secrets (databases, some web apps):

```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    secrets:
      - db_password

secrets:
  db_password:
    file: ./secrets/db_password.txt
```

Steps:
1. Create a `secrets/` directory in the compose project root
2. Generate strong passwords: `openssl rand -base64 32 > secrets/db_password.txt`
3. Set restrictive permissions: `chmod 600 secrets/*.txt`
4. Update compose files to use `_FILE` suffix environment variables
5. Add `secrets/` to `.gitignore`

### Environment Variable Best Practices

- Never commit `.env` files to git
- Use `.env.example` with placeholder values for documentation
- Store actual credentials in `.env` files with `chmod 600`
- Prefer Docker secrets over environment variables when the service supports it
- Rotate credentials periodically, especially after any security incident

### Vaultwarden Configuration

Vaultwarden is the self-hosted Bitwarden-compatible password manager:

1. Ensure Vaultwarden is behind the reverse proxy with HTTPS (check via `homelab_npmProxyHosts`)
2. Disable new user registration after initial setup: `SIGNUPS_ALLOWED=false`
3. Enable admin panel only when needed: `ADMIN_TOKEN=<long-random-string>`
4. Back up the Vaultwarden data volume: `homelab_volumeBackup` with `volume: "vaultwarden_data"`

### Fail2ban for Brute Force Protection

1. Check current jail status: `homelab_fail2banStatus`
2. Ensure SSH jail is active and banning repeat offenders
3. Add Vaultwarden jail if not present:

```ini
[vaultwarden]
enabled = true
port = http,https
filter = vaultwarden
logpath = /var/log/vaultwarden/access.log
maxretry = 5
bantime = 3600
```

## Example Interaction

**User:** I'm worried about security on my Pi. Can you audit my setup?

**Assistant:**

1. Let me check your firewall rules.

   *Calls `homelab_ufwStatus`*

   UFW is active with 12 rules. Ports 22, 80, 443, and 9090 are open. Everything else is denied by default -- that looks good.

2. Let me check for banned IPs from brute force attempts.

   *Calls `homelab_fail2banStatus`*

   The sshd jail is active with 3 currently banned IPs. 47 total bans in the last 24 hours -- SSH is well protected.

3. Let me scan for open ports that might not be firewalled.

   *Calls `homelab_openPorts`*

   I see 18 listening ports. Most are Docker containers on internal interfaces. Port 9100 (node_exporter) is on 0.0.0.0 -- consider binding it to the LAN IP only.

4. Finally, let me scan your containers for known vulnerabilities.

   *Calls `homelab_containerScan`*

   Found 2 HIGH vulnerabilities in the Grafana image (CVE-2026-XXXX). Recommend pulling the latest image: `homelab_composePull`.

   Overall your setup is solid. Three recommendations:
   - Bind node_exporter to LAN IP instead of 0.0.0.0
   - Update Grafana to patch the 2 HIGH CVEs
   - Move any hardcoded passwords in compose files to Docker secrets
