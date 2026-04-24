---
name: certificate-management
description: Let's Encrypt, self-signed certs, renewal automation, NPM cert integration
tools:
  - homelab_certCheck
  - homelab_certRenew
  - homelab_certList
  - homelab_npmCerts
standards-version: 1.6.3
---

# Certificate Management

Guide the user through SSL/TLS certificate lifecycle management, including Let's Encrypt provisioning, renewal automation, self-signed certificate generation, and Nginx Proxy Manager certificate integration.

## Trigger

- User asks about SSL certificates, HTTPS, or TLS on their home lab
- User wants to check certificate expiry dates
- User mentions "certbot", "Let's Encrypt", "SSL", "TLS", "HTTPS", or "certificate"
- User wants to renew or provision a certificate
- User asks about NPM certificate management
- User wants to set up automatic certificate renewal
- User reports browser certificate warnings

## Required Inputs

- SSH connectivity to the Raspberry Pi (validated via `homelab_sshTest`)

Optional:
- Domain name(s) to check or renew
- certbot installed (for Let's Encrypt workflows)
- Nginx Proxy Manager running (for NPM cert workflows)

## Workflow

### Check Certificate Status

1. Run `homelab_certList` to see all certificates from both certbot and NPM.
2. For a specific domain, run `homelab_certCheck` with the domain to get expiry, issuer, and fingerprint.
3. Identify certificates expiring within 30 days for priority renewal.

### Renew Certificates

1. Check current status with `homelab_certList`.
2. For certbot-managed certs, run `homelab_certRenew` with `confirm: true`.
3. For a specific domain only, pass the `domain` parameter.
4. For NPM-managed certs, renewal happens automatically through NPM's built-in ACME -- check via `homelab_npmCerts`.

### Set Up Automatic Renewal

certbot installs a systemd timer by default. Verify it:

1. Check the timer with `homelab_systemdServices` using `unit: "certbot.timer"`.
2. If missing, create one:

```bash
sudo systemctl enable --now certbot.timer
```

3. The timer runs twice daily; certbot only renews certs within 30 days of expiry.
4. Add a post-renewal hook to reload services:

```bash
# /etc/letsencrypt/renewal-hooks/deploy/reload-npm.sh
#!/bin/bash
docker restart npm
```

### Generate Self-Signed Certificates

For internal services that don't need public trust:

```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /opt/homelab/certs/self-signed.key \
  -out /opt/homelab/certs/self-signed.crt \
  -subj "/CN=homelab.local"
```

Import into NPM as a custom certificate for internal-only services.

### NPM Certificate Integration

1. Check NPM certificates with `homelab_npmCerts`.
2. NPM can provision Let's Encrypt certificates directly through its UI.
3. For wildcard certificates, use DNS challenge (requires a DNS provider API token).
4. NPM auto-renews its own certificates -- no certbot needed for NPM-managed domains.

## Key References

- certbot documentation: https://certbot.eff.org
- Let's Encrypt rate limits: 50 certs per registered domain per week
- NPM certificate management in the admin UI
- `/etc/letsencrypt/` directory for certbot configuration and certificates
- systemd timers for automated renewal scheduling

## Example Interaction

**User:** Are any of my SSL certificates about to expire?

**Assistant:**

1. Let me check all managed certificates.

   *Calls `homelab_certList`*

   Found 3 certbot certificates and 5 NPM certificates. The certbot cert for `grafana.example.com` expires in 12 days -- it needs renewal.

2. Let me check the details on that certificate.

   *Calls `homelab_certCheck` with domain "grafana.example.com"*

   Confirmed: expires April 17, 2026. Issued by Let's Encrypt. Let me renew it.

3. Renewing the certificate.

   *Calls `homelab_certRenew` with domain "grafana.example.com", confirm true*

   Successfully renewed. New expiry is July 16, 2026.

   I also checked your certbot timer -- it's active and running twice daily, so this shouldn't happen again. The cert was likely stuck due to a DNS validation issue. All other certificates are valid for at least 45 days.

## MCP Usage

- `homelab_certCheck` -- check expiry, issuer, and fingerprint for a specific domain
- `homelab_certRenew` -- trigger Let's Encrypt renewal for one or all certificates (requires confirm=true)
- `homelab_certList` -- list all certificates from certbot and NPM in one view
- `homelab_npmCerts` -- list NPM-managed SSL certificates and expiry dates

## Common Pitfalls

- certbot renewal requires port 80 to be accessible for HTTP-01 challenges (or DNS-01 for wildcard)
- Let's Encrypt has rate limits -- don't force-renew repeatedly during testing
- NPM and certbot can conflict if both manage the same domain
- Self-signed certificates trigger browser warnings -- only use for internal services
- certbot needs to reload the web server after renewal -- configure deploy hooks
- Wildcard certificates require DNS challenge, not HTTP challenge

## See Also

- `reverse-proxy-management` skill for NPM proxy host configuration
- `network-configuration` skill for DNS and port management
- `notification-workflows` skill for alerting on certificate expiry
- `security-hardening` skill for TLS configuration best practices
