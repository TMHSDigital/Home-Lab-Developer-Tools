import os
import re

import pytest

from conftest import REPO_ROOT


def _find_markdown_files():
    """Find all .md files in the repo."""
    md_files = []
    for root, dirs, files in os.walk(REPO_ROOT):
        dirs[:] = [d for d in dirs if d not in ("node_modules", ".git", "dist")]
        for f in files:
            if f.endswith(".md"):
                md_files.append(os.path.join(root, f))
    return md_files


@pytest.mark.parametrize("md_file", _find_markdown_files())
def test_relative_links_resolve(md_file):
    with open(md_file, "r", encoding="utf-8") as f:
        text = f.read()

    links = re.findall(r"\]\((\.\./[^)]+|\.\/[^)]+)\)", text)
    file_dir = os.path.dirname(md_file)

    for link in links:
        link_path = link.split("#")[0]
        if not link_path:
            continue
        target = os.path.normpath(os.path.join(file_dir, link_path))
        assert os.path.exists(target), (
            f"{os.path.relpath(md_file, REPO_ROOT)} has broken link: {link}"
        )
