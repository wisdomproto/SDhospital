#!/usr/bin/env python3
"""기획서 .md → .html 다시 만들기.

    python scripts/build_proposal.py

스타일(<head>·표지·blockquote 분류 스크립트)은 기존 HTML 것을 그대로 둔다.
목차와 본문만 갈아끼우므로, 디자인을 고치려면 HTML 을 직접 고치면 된다.
"""
import re
import sys
from pathlib import Path

import markdown  # pip install markdown

BASE = Path(__file__).resolve().parent.parent / "docs" / "proposal"
DOC = "2026-07-26-sd-platform-proposal"


def main() -> int:
    md_path, html_path = BASE / f"{DOC}.md", BASE / f"{DOC}.html"
    src = md_path.read_text(encoding="utf-8")

    # 표지에 이미 있는 것들은 본문에서 뺀다 (제목 + 메타 3줄)
    src = re.sub(r"^# .*\n", "", src, count=1)
    src = re.sub(r"^- \*\*(작성일|대상|범위|문서 성격)\*\*.*\n", "", src, flags=re.M)

    conv = markdown.Markdown(
        extensions=["tables", "fenced_code", "toc"],
        extension_configs={"toc": {"toc_depth": "2-3"}},
    )
    body = conv.convert(src.strip())
    # 표는 좁은 화면에서 가로 스크롤되게 감싼다
    body = body.replace("<table>", '<div class="tw"><table>').replace("</table>", "</table></div>")

    html = html_path.read_text(encoding="utf-8")
    head, tail = html.split('<nav class="toc">', 1)
    tail = tail.split("</main>", 1)[1]
    html_path.write_text(
        f'{head}<nav class="toc">{conv.toc}</nav>\n  <main>{body}</main>{tail}',
        encoding="utf-8",
    )
    print(f"{html_path.name}: {len(body):,} bytes body")
    return 0


if __name__ == "__main__":
    sys.exit(main())
