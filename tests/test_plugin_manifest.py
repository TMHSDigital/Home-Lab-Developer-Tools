import os

from conftest import REPO_ROOT


class TestPluginManifest:
    def test_manifest_exists(self, manifest):
        assert manifest is not None

    def test_has_required_fields(self, manifest):
        required = ["name", "displayName", "version", "description", "author"]
        for field in required:
            assert field in manifest, f"plugin.json missing required field: {field}"

    def test_name_is_kebab_case(self, manifest):
        name = manifest.get("name", "")
        assert name == name.lower(), f"Plugin name should be lowercase: {name}"
        assert " " not in name, f"Plugin name should not contain spaces: {name}"

    def test_version_format(self, manifest):
        import re
        version = manifest.get("version", "")
        assert re.match(
            r"^\d+\.\d+\.\d+$", version
        ), f"Version should be semver: {version}"

    def test_skills_path_exists(self, manifest):
        skills_path = manifest.get("skills", "")
        if skills_path:
            full_path = os.path.join(REPO_ROOT, skills_path.lstrip("./"))
            assert os.path.isdir(full_path), f"Skills path does not exist: {full_path}"

    def test_rules_path_exists(self, manifest):
        rules_path = manifest.get("rules", "")
        if rules_path:
            full_path = os.path.join(REPO_ROOT, rules_path.lstrip("./"))
            assert os.path.isdir(full_path), f"Rules path does not exist: {full_path}"

    def test_description_mentions_tool_count(self, manifest):
        desc = manifest.get("description", "")
        assert "15" in desc or "MCP" in desc, (
            "plugin.json description should mention tool count or MCP"
        )
