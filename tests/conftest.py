import json
import os
import re

import pytest
import yaml

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def parse_frontmatter(text):
    """Extract YAML frontmatter from a markdown/mdc file."""
    match = re.match(r"^---\s*\n(.*?)\n---\s*\n", text, re.DOTALL)
    if not match:
        return None
    return yaml.safe_load(match.group(1))


def get_markdown_sections(text):
    """Extract H2 section titles from markdown text."""
    return re.findall(r"^## (.+)$", text, re.MULTILINE)


def get_body(text):
    """Return everything after the YAML frontmatter."""
    match = re.match(r"^---\s*\n.*?\n---\s*\n(.*)$", text, re.DOTALL)
    if match:
        return match.group(1)
    return text


@pytest.fixture(scope="session")
def manifest():
    path = os.path.join(REPO_ROOT, ".cursor-plugin", "plugin.json")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture(scope="session")
def skill_dirs():
    skills_path = os.path.join(REPO_ROOT, "skills")
    if not os.path.isdir(skills_path):
        return []
    return sorted(
        [
            d
            for d in os.listdir(skills_path)
            if os.path.isdir(os.path.join(skills_path, d))
        ]
    )


@pytest.fixture(scope="session")
def rule_files():
    rules_path = os.path.join(REPO_ROOT, "rules")
    if not os.path.isdir(rules_path):
        return []
    return sorted(
        [f for f in os.listdir(rules_path) if f.endswith(".mdc")]
    )


@pytest.fixture(scope="session")
def readme_text():
    path = os.path.join(REPO_ROOT, "README.md")
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


@pytest.fixture(scope="session")
def claude_text():
    path = os.path.join(REPO_ROOT, "CLAUDE.md")
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


@pytest.fixture(scope="session")
def contributing_text():
    path = os.path.join(REPO_ROOT, "CONTRIBUTING.md")
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


@pytest.fixture(scope="session")
def changelog_text():
    path = os.path.join(REPO_ROOT, "CHANGELOG.md")
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


@pytest.fixture(scope="session")
def roadmap_text():
    path = os.path.join(REPO_ROOT, "ROADMAP.md")
    with open(path, "r", encoding="utf-8") as f:
        return f.read()
