import os
import re

import pytest

from conftest import REPO_ROOT, parse_frontmatter, get_markdown_sections, get_body


REQUIRED_SECTIONS = [
    "Trigger",
    "Required Inputs",
    "Workflow",
    "Example Interaction",
]


def _read_skill(skill_dir):
    path = os.path.join(REPO_ROOT, "skills", skill_dir, "SKILL.md")
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def test_all_skills_have_skill_md(skill_dirs):
    for skill_dir in skill_dirs:
        path = os.path.join(REPO_ROOT, "skills", skill_dir, "SKILL.md")
        assert os.path.isfile(path), f"Missing SKILL.md in skills/{skill_dir}/"


@pytest.mark.parametrize(
    "skill_dir",
    sorted(
        [
            d
            for d in os.listdir(os.path.join(REPO_ROOT, "skills"))
            if os.path.isdir(os.path.join(REPO_ROOT, "skills", d))
        ]
    ),
)
class TestSkill:
    def test_has_frontmatter(self, skill_dir):
        text = _read_skill(skill_dir)
        fm = parse_frontmatter(text)
        assert fm is not None, f"skills/{skill_dir}/SKILL.md missing YAML frontmatter"

    def test_name_matches_directory(self, skill_dir):
        text = _read_skill(skill_dir)
        fm = parse_frontmatter(text)
        assert (
            fm.get("name") == skill_dir
        ), f"Frontmatter name '{fm.get('name')}' does not match directory '{skill_dir}'"

    def test_has_description(self, skill_dir):
        text = _read_skill(skill_dir)
        fm = parse_frontmatter(text)
        desc = fm.get("description", "")
        assert len(desc) >= 20, (
            f"skills/{skill_dir}/SKILL.md description too short: {len(desc)} chars"
        )

    def test_has_h1(self, skill_dir):
        text = _read_skill(skill_dir)
        body = get_body(text)
        assert re.search(
            r"^# .+$", body, re.MULTILINE
        ), f"skills/{skill_dir}/SKILL.md missing H1 heading"

    def test_has_required_sections(self, skill_dir):
        text = _read_skill(skill_dir)
        sections = get_markdown_sections(text)
        for section in REQUIRED_SECTIONS:
            assert (
                section in sections
            ), f"skills/{skill_dir}/SKILL.md missing required section: ## {section}"

    def test_minimum_length(self, skill_dir):
        text = _read_skill(skill_dir)
        lines = text.strip().split("\n")
        assert len(lines) >= 50, (
            f"skills/{skill_dir}/SKILL.md too short: {len(lines)} lines (minimum 50)"
        )

    def test_internal_links_resolve(self, skill_dir):
        text = _read_skill(skill_dir)
        links = re.findall(r"\]\(\.\./([^)]+)\)", text)
        skill_base = os.path.join(REPO_ROOT, "skills", skill_dir)
        for link in links:
            target = os.path.join(skill_base, "..", link)
            target = os.path.normpath(target)
            assert os.path.exists(target), (
                f"skills/{skill_dir}/SKILL.md has broken link: ../{link}"
            )
