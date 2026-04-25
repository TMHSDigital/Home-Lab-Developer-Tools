---
name: multi-node-management
description: Managing fleets, node inventory, parallel operations, cross-node monitoring
tools:
  - homelab_nodeList
  - homelab_nodeExec
  - homelab_nodeStatus
  - homelab_inventorySync
standards-version: 1.9.0
---

# Multi-Node Management

Guide the user through managing multiple SSH targets from a single MCP server instance, including node inventory, cross-node operations, and fleet-wide monitoring.

## Trigger

- User asks about managing multiple machines, servers, or Pis
- User mentions "nodes", "fleet", "inventory", or "multi-node"
- User wants to run commands on a specific named host
- User asks about Ansible inventory or Tailscale peer discovery
- User wants to compare status across multiple machines

## Required Inputs

- SSH connectivity to at least one node (validated via `homelab_sshTest`)
- For multi-node: `HOMELAB_NODES` env var configured with named node entries
- For Ansible discovery: Ansible inventory file accessible from the primary Pi
- For Tailscale discovery: Tailscale installed on the primary Pi

## Workflow

### View All Nodes

1. Run `homelab_nodeList` to see all registered nodes and their connectivity status.
2. Each node shows as online or offline based on a live SSH check.
3. The "default" node is always present (configured via `HOMELAB_PI_*` env vars).

### Configure Multi-Node

Set the `HOMELAB_NODES` environment variable as JSON:

```json
{
  "pi5": { "host": "raspi5.local", "user": "tmhs", "keyPath": "~/.ssh/id_ed25519_pi" },
  "nas": { "host": "nas.local", "user": "admin", "keyPath": "~/.ssh/id_ed25519_nas" },
  "pi-zero": { "host": "pizero.local", "user": "pi", "keyPath": "~/.ssh/id_ed25519_pz" }
}
```

Add this to your MCP config's `env` block. The default node (from `HOMELAB_PI_*` vars) is always available even without `HOMELAB_NODES`.

### Check Node Status

1. Run `homelab_nodeStatus` with the node name to get uptime, CPU, memory, and disk.
2. This works like `homelab_piStatus` but targets any registered node.
3. Compare status across nodes by running it for each node.

### Execute Commands on Specific Nodes

1. All existing tools accept an optional `node` parameter.
2. For example: `homelab_serviceHealth` with `node: "nas"` checks Docker containers on the NAS.
3. For arbitrary commands, use `homelab_nodeExec` with `confirm: true`.

### Discover New Nodes

1. Run `homelab_inventorySync` with `source: "ansible"` to list hosts from the Ansible inventory.
2. Or use `source: "tailscale"` to list all Tailscale peers on the network.
3. Results are informational -- manually add discovered nodes to `HOMELAB_NODES`.

### Cross-Node Operations

1. Check all nodes: `homelab_nodeList` for a quick health overview.
2. Target specific nodes: pass `node` parameter to any tool.
3. Compare configurations: run the same tool on different nodes to compare results.

## Key References

- `HOMELAB_NODES` env var: JSON object mapping node names to SSH config
- `HOMELAB_PI_HOST`, `HOMELAB_PI_USER`, `HOMELAB_PI_KEY_PATH`: default node config
- `HOMELAB_ANSIBLE_INVENTORY`: path to Ansible inventory file (default `/etc/ansible/hosts`)
- Tailscale documentation: https://tailscale.com/kb

## Example Interaction

**User:** I have a second Pi running my NAS. Can I manage both from here?

**Assistant:**

1. You need to add the NAS to your node registry. Update your MCP config's env to include:

   ```json
   "HOMELAB_NODES": "{\"nas\":{\"host\":\"nas.local\",\"user\":\"admin\",\"keyPath\":\"~/.ssh/id_ed25519_nas\"}}"
   ```

2. After restarting the MCP server, let me check both nodes.

   *Calls `homelab_nodeList`*

   Both nodes are online:
   - default (raspi5.local) -- online
   - nas (nas.local) -- online

3. Let me check the NAS status.

   *Calls `homelab_nodeStatus` with node "nas"*

   NAS: 45 days uptime, 2.1GB/8GB RAM used, 78% disk. Looks healthy.

4. Now you can use any tool with `node: "nas"` to target it. For example, `homelab_diskUsage` with `node: "nas"` will show disk breakdown on the NAS.

## MCP Usage

- `homelab_nodeList` -- list all nodes and their online/offline status
- `homelab_nodeExec` -- run an arbitrary command on a named node (requires confirm=true)
- `homelab_nodeStatus` -- get system vitals for a specific node
- `homelab_inventorySync` -- discover nodes from Ansible inventory or Tailscale
- Any existing tool with `node` parameter -- target a specific node instead of the default

## Common Pitfalls

- `HOMELAB_NODES` must be valid JSON -- a syntax error silently falls back to default-only mode
- SSH keys for each node must be accessible from wherever the MCP server runs
- Node names are case-sensitive -- "NAS" and "nas" are different nodes
- The `node` parameter on existing tools does not create nodes -- they must be in the registry
- `inventorySync` reads the inventory from the default Pi, not from the MCP server host
- Tailscale peers list includes all devices, not just servers -- filter results manually

## See Also

- `ssh-management` skill for SSH key setup and hardening
- `ansible-workflows` skill for playbook-based multi-node management
- `pi-system-management` skill for single-node system monitoring
- `troubleshooting` skill for debugging connectivity issues
