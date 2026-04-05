import os
import re

import pytest

from conftest import REPO_ROOT, parse_frontmatter, get_body


def _read_rule(rule_file):
    path = os.path.join(REPO_ROOT, "rules", rule_file)
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


@pytest.mark.parametrize(
    "rule_file",
    sorted(
        [
            f
            for f in os.listdir(os.path.join(REPO_ROOT, "rules"))
            if f.endswith(".mdc")
        ]
    ),
)
class TestRule:
    def test_has_frontmatter(self, rule_file):
        text = _read_rule(rule_file)
        fm = parse_frontmatter(text)
        assert fm is not None, f"rules/{rule_file} missing YAML frontmatter"

    def test_has_description(self, rule_file):
        text = _read_rule(rule_file)
        fm = parse_frontmatter(text)
        desc = fm.get("description", "")
        assert len(desc) >= 10, (
            f"rules/{rule_file} description too short: {len(desc)} chars"
        )

    def test_has_always_apply(self, rule_file):
        text = _read_rule(rule_file)
        fm = parse_frontmatter(text)
        assert "alwaysApply" in fm, f"rules/{rule_file} missing alwaysApply field"
        assert isinstance(
            fm["alwaysApply"], bool
        ), f"rules/{rule_file} alwaysApply must be a boolean"

    def test_scoped_rules_have_globs(self, rule_file):
        text = _read_rule(rule_file)
        fm = parse_frontmatter(text)
        if not fm.get("alwaysApply", False):
            globs = fm.get("globs", [])
            assert isinstance(globs, list) and len(globs) > 0, (
                f"rules/{rule_file} has alwaysApply=false but no globs"
            )

    def test_has_h1(self, rule_file):
        text = _read_rule(rule_file)
        body = get_body(text)
        assert re.search(
            r"^# .+$", body, re.MULTILINE
        ), f"rules/{rule_file} missing H1 heading"

    def test_minimum_length(self, rule_file):
        text = _read_rule(rule_file)
        body = get_body(text)
        lines = body.strip().split("\n")
        assert len(lines) >= 10, (
            f"rules/{rule_file} body too short: {len(lines)} lines (minimum 10)"
        )
