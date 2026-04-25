---
name: dns-management
description: Manage AdGuard Home DNS filtering, blocklists, local DNS records, and query log analysis.
tools:
  - homelab_adguardStats
  - homelab_adguardFilters
  - homelab_adguardQueryLog
standards-version: 1.7.0
---

# DNS Management

Configure and manage AdGuard Home on a Raspberry Pi home lab. Covers DNS
filtering, blocklist management, local DNS rewrites, upstream DNS configuration,
and query log analysis for troubleshooting.

## Trigger

- User asks about DNS filtering, ad blocking, or AdGuard configuration
- User wants to add or remove blocklists
- User asks about DNS query logs or which domains are being blocked
- User mentions "AdGuard", "DNS", "blocklist", "ad blocking", or "query log"
- User asks why a website or service is not working (could be DNS blocking)
- User wants to create local DNS records or rewrites
- User asks about upstream DNS servers or DNS-over-HTTPS/TLS

## Required Inputs

- SSH connectivity to the Raspberry Pi (validated via `homelab_sshTest`)
- AdGuard Home running (default port 3000)

Optional:
- AdGuard credentials (`HOMELAB_ADGUARD_USER`/`HOMELAB_ADGUARD_PASSWORD`)
- Specific domain to investigate or unblock
- Blocklist URL to add

## Workflow

1. **Verify connectivity** -- call `homelab_sshTest`.
2. **Check AdGuard health** -- call `homelab_serviceHealth` for the AdGuard container.
3. **For viewing DNS statistics:**
   - Call `homelab_adguardStats` to get query counts, blocked counts, top blocked domains, and top clients
4. **For managing filter lists:**
   - Call `homelab_adguardFilters` to see all configured blocklists and their status
   - Guide the user through adding/removing/toggling lists via the AdGuard API
5. **For investigating DNS issues:**
   - Call `homelab_adguardQueryLog` with the domain or client IP as the search filter
   - Check if the domain is being blocked by a filter list
   - Guide the user to add an exception if needed
6. **For local DNS records:**
   - Guide configuration of DNS rewrites via the AdGuard API or config file
   - Common use case: `service.home.lab` pointing to the Pi's IP
7. **For upstream DNS configuration:**
   - Guide setup of upstream DNS servers (e.g. Cloudflare 1.1.1.1, Quad9 9.9.9.9)
   - Configure DNS-over-HTTPS or DNS-over-TLS for privacy

## Key References

AdGuard Home service:
- Admin UI: `http://pi:3000` (or custom port)
- API base: `http://localhost:PORT/control/`
- Default credentials: admin/admin (should be changed)

File locations:
```
/opt/homelab/docker/network/
  adguard/
    confdir/AdGuardHome.yaml   # Main config file
    workdir/                    # Query log database
```

Common API endpoints:
- `GET /control/stats` -- DNS statistics
- `GET /control/filtering/status` -- filter lists
- `GET /control/querylog?search=DOMAIN&limit=N` -- query log search
- `POST /control/filtering/add_url` -- add a blocklist
- `POST /control/rewrite/add` -- add a DNS rewrite
- `GET /control/dns_info` -- upstream DNS config

Popular blocklists:
- AdGuard DNS filter: `https://adguardteam.github.io/AdGuardSDNSFilter/Filters/filter.txt`
- Steven Black hosts: `https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts`
- OISD blocklist: `https://big.oisd.nl/`

## Example Interaction

**User:** "Why can't I access example.com? Is AdGuard blocking it?"

**Assistant actions:**
1. Call `homelab_adguardQueryLog` with `search: "example.com"`
2. Check the response for blocked queries
3. If blocked, identify which filter list caused it

**Response:**
> example.com was blocked 12 times in the last hour by the "Steven Black hosts"
> filter list. To unblock it, add an exception rule in AdGuard's custom filtering
> rules: `@@||example.com^`

**User:** "Show me my DNS stats for today"

**Assistant actions:**
1. Call `homelab_adguardStats`
2. Format the response

## MCP Usage

| Tool                          | Purpose                                        |
|-------------------------------|-------------------------------------------------|
| `homelab_sshTest`             | Validate connectivity before operations         |
| `homelab_adguardStats`        | Get DNS query statistics and top blocked domains|
| `homelab_adguardFilters`      | List and manage filter/blocklists               |
| `homelab_adguardQueryLog`     | Search DNS queries for troubleshooting          |
| `homelab_serviceHealth`       | Check AdGuard container health                  |
| `homelab_serviceLogs`         | Debug AdGuard startup or config issues          |
| `homelab_serviceRestart`      | Restart AdGuard after config changes            |

## Common Pitfalls

- **DNS port conflict** -- AdGuard needs port 53. If systemd-resolved is running on
  the Pi, it will conflict. Disable it with `systemctl disable --now systemd-resolved`.
- **Blocklist over-blocking** -- aggressive lists can block legitimate services
  (Microsoft, Apple, CDNs). Check query logs before assuming a network issue.
- **Local DNS not propagating** -- clients cache DNS. After adding a rewrite, flush
  DNS on the client (`ipconfig /flushdns` on Windows, `sudo dscacheutil -flushcache`
  on macOS).
- **AdGuard port confusion** -- AdGuard's web UI runs on port 3000 (same default as
  Grafana). If both are running, one must be remapped. Set `HOMELAB_ADGUARD_PORT`
  accordingly.
- **HTTPS bootstrap** -- when using DNS-over-HTTPS as upstream, AdGuard needs a
  bootstrap DNS server to resolve the DoH hostname itself. Configure this in the
  DNS settings.

## See Also

- [network-configuration](../network-configuration/SKILL.md) -- broader network stack overview
- [reverse-proxy-management](../reverse-proxy-management/SKILL.md) -- NPM config for exposing AdGuard
- [troubleshooting](../troubleshooting/SKILL.md) -- general debugging including DNS issues
