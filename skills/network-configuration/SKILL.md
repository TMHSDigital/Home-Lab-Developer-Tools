---
name: network-configuration
description: Configure and manage AdGuard DNS, Nginx Proxy Manager, Tailscale VPN, and port mappings.
tools:
  - homelab_networkInfo
  - homelab_adguardStats
  - homelab_npmProxyHosts
  - homelab_openPorts
standards-version: 1.9.0
---

# Network Configuration

Configure and manage the networking layer of a Raspberry Pi 5 home lab. Covers
AdGuard Home for DNS-level ad blocking, Nginx Proxy Manager for reverse proxying
with SSL, Tailscale for mesh VPN access, and general port/firewall management.

## Trigger

- User asks about DNS, ad blocking, or AdGuard configuration
- User wants to set up a reverse proxy for a service
- User asks about SSL certificates or HTTPS for local services
- User mentions Tailscale, VPN, or remote access
- User asks about ports, firewall rules, or iptables/nftables
- User says "I can't reach [service]" or "DNS isn't working"
- User wants to expose a service externally or via a custom domain

## Required Inputs

- SSH connectivity to the Raspberry Pi (validated via `homelab_sshTest`)

Optional:
- Domain name or subdomain for reverse proxy setup
- Service name and internal port to proxy
- Tailscale auth key for new node registration
- Specific DNS rewrite or filtering rule

## Workflow

1. **Verify connectivity** -- call `homelab_sshTest`.
2. **Gather network state** -- call `homelab_networkInfo` to retrieve IP addresses,
   active interfaces, listening ports, and routing table.
3. **Identify the task** and branch:

   **For DNS/AdGuard Home:**
   - Check AdGuard health via `homelab_serviceHealth`
   - Review DNS rewrites and filtering rules
   - Guide the user through AdGuard's web UI at `http://pi:3000` (or the
     configured port) for filter list management
   - For custom DNS rewrites, edit via the AdGuard API or config file

   **For Reverse Proxy (Nginx Proxy Manager):**
   - Check NPM health via `homelab_serviceHealth`
   - Access NPM at `http://pi:81` for the admin UI
   - Create a proxy host: set domain, forward hostname/IP, forward port, and
     enable SSL with Let's Encrypt or a custom certificate
   - For internal-only services, use a local domain with a self-signed cert
     or a wildcard cert from a DNS challenge provider

   **For Tailscale VPN:**
   - Verify Tailscale is running via `homelab_serviceHealth`
   - Check Tailscale status and connected nodes
   - Guide auth key setup for headless Pi enrollment
   - Configure subnet routing to expose the home lab LAN to the tailnet
   - Set up MagicDNS for `*.ts.net` access to services

   **For Port/Firewall Management:**
   - List listening ports from `homelab_networkInfo`
   - Review ufw or nftables rules
   - Open or close ports as needed, with confirmation from the user

4. **Verify changes** -- call `homelab_networkInfo` again and test connectivity
   to the affected services via `homelab_serviceHealth`.
5. **Report** -- summarize configuration changes and any follow-up steps.

## Key References

Network stack services and ports:
- AdGuard Home DNS: UDP/TCP 53 (DNS), `http://pi:3000` (web UI)
- Nginx Proxy Manager: ports 80 (HTTP), 443 (HTTPS), 81 (admin UI)
- Tailscale: runs as a container or native service, uses WireGuard on UDP 41641

Config file locations:
```
/opt/homelab/docker/network/
  docker-compose.yml              # AdGuard, NPM, Tailscale containers
  adguard/conf/AdGuardHome.yaml   # AdGuard configuration
  npm/data/                       # NPM database and certs
```

Common internal service ports:
- Grafana: 3000 (conflicts with AdGuard if on same port -- check bindings)
- Prometheus: 9090
- Uptime Kuma: 3001
- Portainer: 9443
- Vaultwarden: 8222
- Ntfy: 8080
- Code Server: 8443

## Example Interaction

**User:** "Set up a reverse proxy for Grafana at grafana.home.lab"

**Assistant actions:**
1. Call `homelab_sshTest`
2. Call `homelab_serviceHealth` for Nginx Proxy Manager
3. Call `homelab_networkInfo` to confirm Grafana is listening on port 3000
4. Guide user through NPM proxy host creation

**Response:**
> NPM is healthy. Grafana is listening on port 3000. In Nginx Proxy Manager:
> 1. Add a new proxy host for `grafana.home.lab`
> 2. Forward to `grafana` (container name) on port 3000
> 3. Enable "Websockets Support" for live dashboard updates
> 4. Request a Let's Encrypt cert (or use your wildcard)
>
> Add a DNS rewrite in AdGuard: `grafana.home.lab` -> Pi's IP address.

**User:** "Why can't I reach Portainer from outside my network?"

**Assistant actions:**
1. Call `homelab_networkInfo` -- check if port 9443 is exposed
2. Call `homelab_serviceHealth` for Portainer
3. Check if Tailscale or NPM is routing external traffic

## MCP Usage

| Tool                    | Purpose                                         |
|--------------------------|-----------------------------------------------|
| `homelab_sshTest`        | Validate SSH connectivity                      |
| `homelab_networkInfo`    | Get IPs, ports, interfaces, routing table      |
| `homelab_serviceHealth`  | Check health of network services               |
| `homelab_serviceLogs`    | Debug DNS or proxy errors                      |
| `homelab_serviceRestart` | Restart network services after config changes  |
| `homelab_composePs`      | Check container status in the network stack    |
| `homelab_composeUp`      | Redeploy network stack after compose edits     |

## Common Pitfalls

- **Port 53 conflicts** -- if systemd-resolved is running on the Pi, it binds
  port 53 and blocks AdGuard. Disable the stub listener:
  `DNSStubListener=no` in `/etc/systemd/resolved.conf`.
- **AdGuard and Grafana port clash** -- both default to port 3000. The compose
  files should remap one of them. Verify with `homelab_networkInfo`.
- **Let's Encrypt rate limits** -- requesting too many certs for the same domain
  in a short period triggers rate limiting. Use staging certs for testing.
- **Tailscale subnet routing** -- enabling `--advertise-routes` on the Pi requires
  approving the routes in the Tailscale admin console. The Pi advertising alone
  is not sufficient.
- **DNS not propagating** -- after adding an AdGuard rewrite, client devices may
  cache the old DNS response. Flush DNS caches or wait for TTL expiry.
- **Firewall ordering** -- ufw rules are evaluated top-down. A broad DENY before
  a specific ALLOW will block the traffic. Check rule order with `ufw status
  numbered`.
- **NPM database corruption** -- if NPM fails to start after a crash, the SQLite
  database at `npm/data/database.sqlite` may be corrupt. Restore from backup or
  delete and reconfigure.

## See Also

- `docker-compose-stacks` -- managing the network stack deployment
- `service-monitoring` -- monitoring DNS query rates and proxy health
- `pi-system-management` -- checking if network issues are caused by hardware
- `backup-recovery` -- backing up AdGuard config and NPM certificates
