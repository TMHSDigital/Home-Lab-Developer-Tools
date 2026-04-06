# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do not** open a public issue
2. Email the maintainer or use GitHub's private vulnerability reporting
3. Include steps to reproduce and potential impact

## Scope

This project connects to remote hosts via SSH. Security considerations:

- SSH private keys must never be committed to the repository
- The `.env` file containing connection details is gitignored
- MCP tools execute commands on remote hosts -- review tool actions before running
- Tools with destructive actions require explicit `confirm=true` parameters: `homelab_piReboot`, `homelab_backupRun`, `homelab_backupRestore`, `homelab_volumeBackup`, `homelab_certRenew`, `homelab_nodeExec`

## Best Practices

- Use SSH key-based authentication (no passwords)
- Store SSH keys with restrictive permissions (600)
- Use environment variables for all connection details
- Review MCP tool output before acting on it in automation
