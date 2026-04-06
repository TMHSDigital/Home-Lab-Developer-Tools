---
name: ansible-workflows
description: Write and run Ansible playbooks for multi-node home lab provisioning and configuration management.
tools:
  - homelab_inventorySync
  - homelab_nodeList
  - homelab_nodeExec
---

# Ansible Workflows

## Trigger

Use this skill when the user wants to:
- Create or edit Ansible playbooks for home lab provisioning
- Set up or modify the Ansible inventory for Pi nodes
- Run playbooks from Windows using Docker or WSL
- Write roles for deploying services, configuring networking, or hardening security
- Debug Ansible task failures or connection issues
- Manage group_vars and host_vars for environment-specific configuration

## Required Inputs

- Target host(s) -- Pi hostname or IP, or inventory group name
- Desired outcome -- what the playbook should provision or configure
- Ansible project location -- defaults to `ansible/` in the repo root
- SSH key path for the control node to reach managed hosts

## Workflow

1. **Check connectivity** -- call `homelab_sshTest` to verify the target Pi is reachable from the network.
2. **Review inventory** -- inspect `ansible/inventory/hosts.yml` for the target host definition. Ensure the host has the correct `ansible_host`, `ansible_user`, and `ansible_ssh_private_key_file` set.
3. **Identify or create the playbook**:
   - Playbooks live in `ansible/playbooks/`.
   - Use FQCN (Fully Qualified Collection Name) for all modules -- e.g., `ansible.builtin.apt`, `ansible.builtin.copy`, `community.docker.docker_compose_v2`.
   - Structure tasks with clear `name` fields, `become: true` where root is needed, and `tags` for selective runs.
4. **Write or update roles** (if applicable):
   - Roles live in `ansible/roles/<role_name>/` with standard structure: `tasks/`, `handlers/`, `templates/`, `defaults/`, `vars/`.
   - Use `ansible.builtin.template` for config files with Jinja2 variables.
   - Use `ansible.builtin.handler` with `notify` for service restarts.
5. **Configure group_vars**:
   - `ansible/inventory/group_vars/all.yml` for shared variables.
   - `ansible/inventory/group_vars/<group>.yml` for group-specific settings.
   - Sensitive values go in `ansible/inventory/group_vars/vault.yml` encrypted with `ansible-vault`.
6. **Run the playbook**:
   - From Windows via Docker:
     ```powershell
     docker run --rm -v ${PWD}/ansible:/ansible -w /ansible \
       willhallonline/ansible:latest \
       ansible-playbook -i inventory/hosts.yml playbooks/<playbook>.yml
     ```
   - With verbose output for debugging: add `-vvv`.
   - Dry run first: add `--check --diff`.
7. **Validate** -- call `homelab_piStatus` and `homelab_serviceHealth` to confirm the provisioned state matches expectations.

## Key References

- Ansible directory layout: `ansible/inventory/`, `ansible/playbooks/`, `ansible/roles/`
- Compose stacks deployed by Ansible are at `/opt/homelab/docker/` on the Pi
- FQCN module index: `ansible.builtin.*`, `community.docker.*`, `community.general.*`
- Ansible Vault for encrypting secrets in version control

## Example Interaction

**User**: "Create a playbook that installs and configures Prometheus node_exporter on the Pi."

**Agent response**:

1. Check `ansible/inventory/hosts.yml` for the Pi host entry.
2. Create `ansible/playbooks/setup-node-exporter.yml`:
   ```yaml
   ---
   - name: Deploy node_exporter
     hosts: pis
     become: true
     tasks:
       - name: Install node_exporter
         ansible.builtin.apt:
           name: prometheus-node-exporter
           state: present
           update_cache: true

       - name: Enable and start node_exporter
         ansible.builtin.systemd:
           name: prometheus-node-exporter
           enabled: true
           state: started

       - name: Open firewall port for node_exporter
         community.general.ufw:
           rule: allow
           port: "9100"
           proto: tcp
   ```
3. Run with check mode first:
   ```powershell
   docker run --rm -v ${PWD}/ansible:/ansible -w /ansible \
     willhallonline/ansible:latest \
     ansible-playbook -i inventory/hosts.yml playbooks/setup-node-exporter.yml --check --diff
   ```
4. Call `homelab_serviceHealth` to verify node_exporter is running after the real run.

## MCP Usage

| Tool | Purpose |
|------|---------|
| `homelab_sshTest` | Pre-flight connectivity check before running playbooks |
| `homelab_piStatus` | Verify system state after provisioning |
| `homelab_serviceHealth` | Confirm deployed services are running |
| `homelab_serviceLogs` | Debug service startup failures post-deployment |
| `homelab_serviceRestart` | Restart a service if Ansible handler did not trigger |
| `homelab_aptUpdate` | Check for package updates before running apt tasks |
| `homelab_composeUp` | Bring up Docker stacks deployed by playbooks |
| `homelab_composePs` | Verify container state after compose deployment |

## Common Pitfalls

- **Not using FQCN** -- short module names like `apt` are deprecated. Always use `ansible.builtin.apt`.
- **Missing become** -- most system tasks require `become: true`. Forgetting it causes permission denied errors.
- **Windows line endings** -- YAML files with CRLF endings cause parse errors. Configure Git with `core.autocrlf=input` or use `.gitattributes`.
- **SSH key path in Docker** -- when running Ansible from a Docker container on Windows, mount the SSH key and ensure correct permissions inside the container.
- **Vault password** -- if using ansible-vault, pass `--vault-password-file` or `--ask-vault-pass` at runtime. Do not hardcode vault passwords.
- **Idempotency** -- always write tasks that can run multiple times safely. Use `state: present` not shell commands for package installs.

## See Also

- `ssh-management` -- SSH key setup required before Ansible can connect
- `security-hardening` -- playbooks for UFW, fail2ban, and SSH hardening
- `docker-compose-stacks` -- managing the compose files that Ansible deploys
- `pi-system-management` -- system-level tasks that playbooks automate
