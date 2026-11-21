# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do not** open a public issue
2. Email the maintainer or use GitHub's private vulnerability reporting
3. Include steps to reproduce and potential impact

## Scope

This project connects to remote hosts via SSH. Security considerations:

- SSH private keys must never be committed to the repository
- The server reads its settings only from the environment the MCP client passes (the `env` block of the client config); it does not load a `.env` file. Keep that client config out of version control. `.env` is gitignored in case you keep local notes there
- MCP tools execute commands on remote hosts -- review tool actions before running
- Tools with destructive or state-changing actions require explicit `confirm=true` parameters: `homelab_piReboot`, `homelab_backupRun`, `homelab_backupRestore`, `homelab_volumeBackup`, `homelab_certRenew`, `homelab_nodeExec`, `homelab_serviceRestart`, `homelab_composeUp`, `homelab_composeDown`, `homelab_adguardFilterToggle`, `homelab_adguardRewriteSet`, `homelab_alertSilence`, `homelab_systemdControl`, `homelab_grafanaImport`, and `homelab_aptUpdate` when `upgrade=true`. Called with `confirm: false`, they return a preview of the command and run nothing; a call that omits `confirm` fails input validation (`homelab_aptUpdate` is the exception: `confirm` is optional and only needed with `upgrade=true`)

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

Set `HOMELAB_DRY_RUN=true` to make tools return the command they would execute (the first one, for tools that run several) without opening an SSH connection. Unsafe commands are still rejected in dry-run mode.

## Best Practices

- Use SSH key-based authentication (no passwords)
- Store SSH keys with restrictive permissions (600)
- Use environment variables for all connection details
- Review MCP tool output before acting on it in automation
