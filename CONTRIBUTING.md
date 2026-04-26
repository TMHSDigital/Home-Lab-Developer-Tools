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
npm run dev  # watch mode with tsx
```

### Running structure tests

```bash
pip install -r requirements-test.txt
pytest tests/ -v --tb=short
```

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

1. Create a new `.ts` file in `mcp-server/src/tools/`
2. Follow this pattern:

```typescript
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";
import { nodeParam } from "../utils/node-param.js";

const inputSchema = {
  ...nodeParam,
  paramName: z.string().min(1).describe("What this parameter does"),
};

export function register(server: McpServer): void {
  server.tool(
    "homelab_toolName",
    "What this tool does",
    inputSchema,
    async (args) => {
      try {
        const output = await execSSH("command", args.node);
        return {
          content: [{ type: "text" as const, text: output }],
        };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );
}
```

3. Register the tool in `src/index.ts`
4. Add input validation tests in `src/tools/__tests__/input-validation.test.ts`

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
