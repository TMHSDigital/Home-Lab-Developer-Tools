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
- Tools with destructive or state-changing actions require explicit `confirm=true` parameters: `homelab_piReboot`, `homelab_backupRun`, `homelab_backupRestore`, `homelab_volumeBackup`, `homelab_certRenew`, `homelab_nodeExec`, `homelab_serviceRestart`, `homelab_composeUp`, `homelab_composeDown`

## Runtime Command Guard

`execSSH` blocks a focused set of catastrophic command patterns before opening an SSH connection:

- `rm -rf /` (and `--no-preserve-root` variant)
- `mkfs` targeting a block device
- `dd` writing to a block device
- Fork bomb (`:(){ :|:& };:`)
- `chmod -R 777 /`
- Piping a remote download to a shell (`curl ... | sh`, `wget ... | bash`)
- `shutdown -h`, `halt`, `poweroff` (note: `shutdown -r` used by `homelab_piReboot` is explicitly allowed)

To bypass the guard (not recommended): set `HOMELAB_ALLOW_DANGEROUS_COMMANDS=true`.

## Dry-Run Mode

Set `HOMELAB_DRY_RUN=true` to make `execSSH` print what it would execute without opening an SSH connection. Unsafe commands are still rejected in dry-run mode.

## Best Practices

- Use SSH key-based authentication (no passwords)
- Store SSH keys with restrictive permissions (600)
- Use environment variables for all connection details
- Review MCP tool output before acting on it in automation
