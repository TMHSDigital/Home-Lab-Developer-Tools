---
name: reverse-proxy-management
description: Configure Nginx Proxy Manager for reverse proxying, SSL certificates, and access control.
tools:
  - homelab_npmProxyHosts
  - homelab_npmCerts
  - homelab_certCheck
standards-version: 1.7.0
---

# Reverse Proxy Management

Configure and manage Nginx Proxy Manager (NPM) on a Raspberry Pi home lab.
Covers proxy host setup, SSL certificate management, access lists, custom
locations, and stream proxying for non-HTTP services.

## Trigger

- User asks about reverse proxy setup or configuration
- User wants to expose a service via a custom domain
- User asks about SSL certificates, HTTPS, or Let's Encrypt
- User mentions "NPM", "Nginx Proxy Manager", "reverse proxy", or "proxy host"
- User asks about access lists or restricting access to a service
- User wants to see what services are proxied
- User says "I can't reach [service] via my domain"

## Required Inputs

- SSH connectivity to the Raspberry Pi (validated via `homelab_sshTest`)
- Nginx Proxy Manager running (default admin port 81)

Optional:
- NPM credentials (`HOMELAB_NPM_EMAIL`/`HOMELAB_NPM_PASSWORD`)
- Domain name or subdomain to proxy
- Target service hostname/IP and port
- SSL provider preference (Let's Encrypt, custom)

## Workflow

1. **Verify connectivity** -- call `homelab_sshTest`.
2. **Check NPM health** -- call `homelab_serviceHealth` for the NPM container.
3. **For listing proxy hosts:**
   - Call `homelab_npmProxyHosts` to see all configured proxy hosts
   - Show domain, forward host/port, SSL status for each
4. **For adding a new proxy host:**
   - Determine the target service's internal hostname (container name) and port
   - Guide the user through the NPM UI or API to create the proxy host
   - Configure SSL with Let's Encrypt if the domain is publicly resolvable
5. **For checking SSL certificates:**
   - Call `homelab_npmCerts` to list all managed certificates and expiry dates
   - Flag any certificates expiring within 30 days
6. **For troubleshooting proxy issues:**
   - Call `homelab_npmProxyHosts` to verify the proxy host config
   - Check NPM logs via `homelab_serviceLogs`
   - Verify the target service is healthy via `homelab_serviceHealth`
   - Check DNS resolution via `homelab_adguardQueryLog`

## Key References

NPM service:
- Admin UI: `http://pi:81`
- API base: `http://localhost:81/api/`
- Default credentials: admin@example.com / changeme (must change on first login)

File locations:
```
/opt/homelab/docker/network/
  npm/
    data/                    # NPM database and config
    letsencrypt/             # Let's Encrypt certificates
```

Common API endpoints:
- `POST /api/tokens` -- authenticate and get bearer token
- `GET /api/nginx/proxy-hosts` -- list all proxy hosts
- `POST /api/nginx/proxy-hosts` -- create a proxy host
- `GET /api/nginx/certificates` -- list SSL certificates
- `GET /api/nginx/redirection-hosts` -- list redirections
- `GET /api/nginx/streams` -- list TCP/UDP stream proxies

Typical proxy host config:
```json
{
  "domain_names": ["grafana.home.lab"],
  "forward_scheme": "http",
  "forward_host": "grafana",
  "forward_port": 3000,
  "ssl_forced": true,
  "certificate_id": 1,
  "block_exploits": true,
  "allow_websocket_upgrade": true
}
```

## Example Interaction

**User:** "What services am I proxying through NPM?"

**Assistant actions:**
1. Call `homelab_npmProxyHosts`
2. Format the list with domain, target, and SSL status

**Response:**
> You have 5 proxy hosts configured:
> - grafana.home.lab -> grafana:3000 (SSL: Let's Encrypt, valid)
> - adguard.home.lab -> adguard:3000 (SSL: Let's Encrypt, valid)
> - portainer.home.lab -> portainer:9000 (SSL: none)
> - homepage.home.lab -> homepage:3000 (SSL: Let's Encrypt, valid)
> - vaultwarden.home.lab -> vaultwarden:80 (SSL: Let's Encrypt, valid)

**User:** "Are any of my SSL certificates about to expire?"

**Assistant actions:**
1. Call `homelab_npmCerts`
2. Check expiry dates against current date

## MCP Usage

| Tool                          | Purpose                                         |
|-------------------------------|--------------------------------------------------|
| `homelab_sshTest`             | Validate connectivity before operations          |
| `homelab_npmProxyHosts`       | List proxy host configurations                   |
| `homelab_npmCerts`            | List SSL certificates and expiry dates           |
| `homelab_serviceHealth`       | Check NPM and target service health              |
| `homelab_serviceLogs`         | Debug NPM errors and proxy issues                |
| `homelab_serviceRestart`      | Restart NPM after config changes                 |
| `homelab_networkInfo`         | Check network config and DNS resolution          |

## Common Pitfalls

- **Default credentials** -- NPM ships with admin@example.com / changeme. It forces
  a password change on first login via the UI, but the API still accepts the defaults
  until changed. Always change these.
- **Internal vs external DNS** -- for `.home.lab` domains to work, the client must
  use AdGuard (or another local DNS) that resolves them to the Pi's IP. External
  domains need public DNS records pointing to the Pi's public IP.
- **Port 80/443 conflicts** -- NPM needs ports 80 and 443 for HTTP/HTTPS. No other
  container or service should bind to these ports.
- **Let's Encrypt rate limits** -- Let's Encrypt has rate limits (50 certs per domain
  per week). Use the staging environment for testing. NPM supports this via the
  "Use a DNS Challenge" option.
- **WebSocket support** -- services like Grafana, Portainer, and Code Server need
  WebSocket. Enable "Websockets Support" in the proxy host config.
- **Container networking** -- NPM must be on the same Docker network as the services
  it proxies. Use the container name (not localhost) as the forward host.
- **SSL renewal** -- Let's Encrypt certs auto-renew, but if the renewal fails (port
  80 blocked, DNS misconfigured), the cert expires silently. Monitor with
  `homelab_npmCerts`.

## See Also

- [network-configuration](../network-configuration/SKILL.md) -- broader network stack overview
- [dns-management](../dns-management/SKILL.md) -- AdGuard DNS config for local domain resolution
- [security-hardening](../security-hardening/SKILL.md) -- access lists and firewall rules
