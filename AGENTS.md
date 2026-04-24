<!-- standards-version: 1.6.3 -->

# AGENTS.md

Guidance for AI coding agents working on the Home Lab Developer Tools repository.

## Repository overview

A Cursor IDE plugin for home lab and Raspberry Pi workflows. 22 skills and 11 rules covering Docker Compose, monitoring, DNS, networking, backups, security, and administration via SSH. Includes a companion MCP server (`@tmhs/homelab-mcp`) with 50 tools for live infrastructure management.

**Docs site:** https://tmhsdigital.github.io/Home-Lab-Developer-Tools/

## Repository structure

```
Home-Lab-Developer-Tools/
  .cursor-plugin/plugin.json   # Plugin manifest (name, version, description)
  skills/                      # 22 skill directories, each with SKILL.md
  rules/                       # 11 rule files (.mdc)
  mcp-server/                  # Companion MCP server (Node.js/TypeScript)
    src/                       # Server source code
    dist/                      # Compiled output
  mcp-tools.json               # MCP tool catalog (50 tools, manually maintained)
  site.json                    # GitHub Pages branding/config
  docs/                        # Generated GitHub Pages site (do not edit manually)
  assets/                      # Logo and images
  tests/                       # Test suite
  .github/workflows/           # CI/CD (auto-tag, ci, codeql, dep-review, e2e, links, pages, publish, release-drafter, stale, validate)
```

## Branching and commit model

- **Single branch:** `main` only
- **Conventional commits:** `feat:`, `fix:`, `chore:`, `docs:`

## Skills

Each skill lives in `skills/<skill-name>/SKILL.md`. Every SKILL.md starts with YAML frontmatter:

```yaml
---
name: skill-name
description: One-line description of what the skill does
---
```

The `name` and `description` fields are parsed by the site template build system to generate the GitHub Pages site. When adding a new skill:
1. Create `skills/<skill-name>/SKILL.md` with frontmatter
2. Update the `skills` count in `.cursor-plugin/plugin.json`
3. Use `feat:` commit prefix

## Rules

Rules are `.mdc` files in `rules/`. Each starts with YAML frontmatter containing `description` and `globs` fields.

## MCP Tools

`mcp-tools.json` is a manually maintained JSON array of all MCP tools. Each entry has `name`, `description`, and `category` fields. This file is used by the GitHub Pages build system to render the tools catalog. When adding or removing tools from `mcp-server/`, update this file accordingly.

## GitHub Pages

The docs site is auto-generated. Do not edit `docs/index.html` directly. It is built by the shared template system from the Developer-Tools-Directory repo.

Data sources:
- `.cursor-plugin/plugin.json` -- metadata
- `site.json` -- branding (accent color, install steps, links)
- `skills/*/SKILL.md` -- parsed for name/description via frontmatter
- `rules/*.mdc` -- parsed for name/scope/description
- `mcp-tools.json` -- tool catalog

The `pages.yml` workflow clones Developer-Tools-Directory, runs `build_site.py`, and deploys the output.

## CI/CD workflows

- `ci.yml` -- runs tests on push/PR
- `e2e.yml` -- end-to-end tests
- `validate.yml` -- validates plugin.json schema
- `pages.yml` -- builds and deploys GitHub Pages via shared template
- `publish.yml` -- publishes MCP server to npm
- `auto-tag.yml` -- auto-tags releases from version bumps
- `codeql.yml` -- security scanning
- `dependency-review.yml` -- audits PR dependencies
- `release-drafter.yml` -- auto-drafts release notes
- `stale.yml` -- marks/closes inactive issues and PRs
- `links.yml` -- checks for broken links

## Key conventions

- No em dashes or en dashes -- use hyphens or rewrite
- No hardcoded credentials, tokens, or API keys
- Conventional commits required
- CC-BY-NC-ND-4.0 license
- All content written for public readership
