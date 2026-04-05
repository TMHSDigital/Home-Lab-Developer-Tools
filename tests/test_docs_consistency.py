import os
import re

from conftest import REPO_ROOT


class TestDocsConsistency:
    def test_readme_exists(self):
        assert os.path.isfile(os.path.join(REPO_ROOT, "README.md"))

    def test_claude_md_exists(self):
        assert os.path.isfile(os.path.join(REPO_ROOT, "CLAUDE.md"))

    def test_changelog_exists(self):
        assert os.path.isfile(os.path.join(REPO_ROOT, "CHANGELOG.md"))

    def test_contributing_exists(self):
        assert os.path.isfile(os.path.join(REPO_ROOT, "CONTRIBUTING.md"))

    def test_roadmap_exists(self):
        assert os.path.isfile(os.path.join(REPO_ROOT, "ROADMAP.md"))

    def test_readme_has_tool_table(self, readme_text):
        assert "homelab_" in readme_text, "README should reference MCP tools"

    def test_claude_md_has_tool_table(self, claude_text):
        assert "homelab_" in claude_text, "CLAUDE.md should reference MCP tools"

    def test_readme_has_skill_table(self, readme_text):
        assert "skills" in readme_text.lower(), "README should reference skills"

    def test_no_emdashes_in_readme(self, readme_text):
        assert "\u2014" not in readme_text, "README contains em dashes"

    def test_no_emdashes_in_claude(self, claude_text):
        assert "\u2014" not in claude_text, "CLAUDE.md contains em dashes"
