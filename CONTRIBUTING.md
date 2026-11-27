# Contributing to Home Lab Developer Tools

## Getting Started

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/Home-Lab-Developer-Tools.git
   cd Home-Lab-Developer-Tools
   ```
3. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Local Development

### Plugin development

Symlink the repo to your Cursor plugins directory:

**Windows (PowerShell as Admin):**
```powershell
New-Item -ItemType SymbolicLink -Path "$env:USERPROFILE\.cursor\plugins\home-lab-developer-tools" -Target (Get-Location)
```

### MCP server development

```bash
cd mcp-server
npm install
npm run build
npm test
npm run typecheck
npm run dev  # watch mode with tsx
```

### Running structure tests

```bash
pip install -r requirements-test.txt
pytest tests/ -v --tb=short
```

### SSH end-to-end tests

Every pull request runs a separate OpenSSH fixture job on Ubuntu. It builds a small Debian container, generates a temporary client key, and exercises real SSH authentication, read-only tool commands, and exit-code/stderr handling. No Pi or repository secrets are required.

To run the same tests locally, install Docker, Bash and the OpenSSH client, then run:

```bash
cd mcp-server
npm ci
bash scripts/test-ssh-e2e.sh
```

The script binds SSH to a random loopback port and removes the container and temporary keys on exit. `HOMELAB_TEST_SSH=true` enables only the fixture suite; ordinary `npm test` skips it.

The optional live-Pi suite runs weekly or through `workflow_dispatch` when the upstream repository has `PI_CONFIGURED=true` and the `PI_HOST`, `PI_USER` and base64-encoded `PI_KEY` secrets. It never runs for pull requests. Manual dispatch without `PI_CONFIGURED=true` reports a configuration error instead of silently skipping. Locally, opt in with `HOMELAB_TEST_PI=true` and the usual `HOMELAB_PI_*` settings, then run `npm test -- src/tools/__tests__/e2e.test.ts`. Each remote test has a 60-second timeout; the live disk-usage probe is limited to `/var/log`.

## Plugin Structure

```
Home-Lab-Developer-Tools/
  .cursor-plugin/
    plugin.json              # Plugin manifest
  skills/
    <skill-name>/
      SKILL.md               # One skill per directory
  rules/
    <rule-name>.mdc           # Rule files
  mcp-server/
    src/
      index.ts               # MCP server entry point
      tools/<tool-name>.ts   # One file per MCP tool
      utils/                 # Shared helpers
```

## Adding a Skill

1. Create a new directory under `skills/` with a kebab-case name
2. Create `SKILL.md` inside that directory
3. Use this template:

```markdown
---
name: your-skill-name
description: One-line description of what this skill does.
tools:
  - homelab_toolName
---

# Your Skill Title

## Trigger

- When to activate this skill (bullet list)

## Required Inputs

- **Input name** - description of what's needed

## Workflow

1. Step-by-step workflow
2. Include code examples

## Key References

| Resource | URL |
|----------|-----|
| Relevant Docs | https://example.com |

## Example Interaction

**User:** Example question

**Agent:** Example response

## MCP Usage

Describe which `homelab_*` MCP tools this skill uses.

## Common Pitfalls

1. Common mistake and how to avoid it

## See Also

- Related Skill -- link to ../related-skill/SKILL.md
```

### Skill requirements

- `name` in frontmatter must match the directory name
- `description` must be at least 20 characters
- Must include H1 heading
- Must include sections: Trigger, Required Inputs, Workflow, Example Interaction
- Must be at least 50 lines
- All relative links must resolve to existing files

## Adding a Rule

1. Create a `.mdc` file in the `rules/` directory
2. Include `description` and `alwaysApply` in frontmatter
3. If `alwaysApply: false`, include `globs` with file patterns
4. Body must be at least 10 lines with H1 heading

## Adding an MCP Tool

1. Create a new `.ts` file in `mcp-server/src/tools/`. The file name is the tool name without the `homelab_` prefix (`fooBar.ts` registers `homelab_fooBar`).
2. Follow this pattern for a read-only tool:

```typescript
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";
import { nodeParam } from "../utils/node-param.js";
import { READ_ONLY } from "../utils/annotations.js";

const inputSchema = {
  ...nodeParam,
  paramName: z.string().min(1).describe("What this parameter does"),
};

export function register(server: McpServer): void {
  server.registerTool(
    "homelab_toolName",
    {
      description: "What this tool does",
      inputSchema,
      annotations: READ_ONLY,
    },
    async (args) => {
      try {
        const output = await execSSH("command", args.node);
        return { content: [{ type: "text" as const, text: output }] };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );
}
```

   A tool that changes running state must be confirm-gated: spread `confirmParam` into the schema, return `confirmCancelled(...)` with a preview when `confirm` is not `true`, and use the `destructive(idempotent)` annotation:

```typescript
import { confirmParam, confirmCancelled } from "../utils/confirm-param.js";
import { destructive } from "../utils/annotations.js";

const inputSchema = {
  ...nodeParam,
  service: z.string().min(1).describe("Container name"),
  ...confirmParam,
};

export function register(server: McpServer): void {
  server.registerTool(
    "homelab_toolName",
    {
      description: "What this tool does (requires confirm=true)",
      inputSchema,
      annotations: destructive(false),
    },
    async (args) => {
      const command = `docker restart '${args.service}'`;
      if (!args.confirm) {
        return confirmCancelled("Restart", { node: args.node, commands: () => [command] });
      }
      try {
        const output = await execSSH(command, args.node);
        return { content: [{ type: "text" as const, text: output }] };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );
}
```

   Use `changesState(idempotent)` only for tools that change state without removing anything and are not gated (today `homelab_composePull` and `homelab_ntfySend`). Never use the deprecated `server.tool()` overload; `registration.test.ts` rejects it.

3. Add the tool to `TOOLS` in `mcp-server/src/tool-registry.ts` (import plus one map entry). `index.ts` registers every entry, and the input-validation and confirm-gate tests read the same map.
4. Add tests in `mcp-server/src/tools/__tests__/`: input validation cases in `input-validation.test.ts`, a handler test in `handlers.test.ts` for the command it runs and how it reports errors, and for a gated tool an entry in `confirm-gates.test.ts` and in the gated lists of `registration.test.ts`, `CLAUDE.md` and `SECURITY.md`.
5. Update the docs that `registration.test.ts` checks:
   - Add the tool to the tool tables in `README.md`, `CLAUDE.md` and `mcp-server/README.md`, and to `mcp-tools.json`.
   - Update the tool count in `.cursor-plugin/plugin.json` (description), `mcp-server/package.json` (description), `README.md` (stat line, badge and category heading), `CLAUDE.md` (`## MCP Tools (N)`), `mcp-server/README.md`, `AGENTS.md` and `site.json`.
   - Add a line to the `[Unreleased]` section of `CHANGELOG.md`.
6. Run `cd mcp-server && npm run build && npm test && npm run typecheck`. To run the live tests against a real Pi as well, set `HOMELAB_TEST_PI=true` with the usual `HOMELAB_PI_*` settings.

## Pull Request Process

1. Ensure all tests pass:
   ```bash
   cd mcp-server && npm run build && npm test
   pytest tests/ -v --tb=short
   ```
2. Update `CHANGELOG.md` with your changes
3. Fill out the PR template completely

## Style Guidelines

- **No em dashes.** Use regular dashes (-) or double dashes (--).
- **No emojis.**
- **No hardcoded credentials.** Use environment variables.
- **Practical examples.** Code should be copy-pasteable and realistic.

## Developer Certificate of Origin and Inbound License Grant

This project uses CC-BY-NC-ND-4.0 as its outbound license, which forbids derivatives. Every pull request is a derivative. Contributions are accepted inbound under a broader grant via the Developer Certificate of Origin (DCO), which resolves the conflict so the project can accept and redistribute contributions.

### Required grant

By submitting a contribution to this repository, you certify that you have the right to do so under the Developer Certificate of Origin (DCO) 1.1, and you grant TMHSDigital a perpetual, worldwide, non-exclusive, royalty-free, irrevocable license to use, reproduce, prepare derivative works of, publicly display, publicly perform, sublicense, and distribute your contribution under the project's current license (CC-BY-NC-ND-4.0) or any successor license chosen by the project.

### DCO sign-off

Every commit in a pull request must have a `Signed-off-by:` trailer matching the commit author:

```
Signed-off-by: Jane Developer <jane@example.com>
```

Signing is done at commit time:

```bash
git commit -s -m "feat: add new skill"
```

The GitHub DCO App enforces this on every PR.

For the full inbound/outbound model and rationale, see [`standards/licensing.md`](https://github.com/TMHSDigital/Developer-Tools-Directory/blob/main/standards/licensing.md) in the Developer-Tools-Directory meta-repo.

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md).
