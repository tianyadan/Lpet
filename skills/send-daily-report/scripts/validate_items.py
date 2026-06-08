#!/usr/bin/env python3
"""校验日报条目条数与每条字数（30～60 汉字）。"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path


def _split_items(text: str) -> list[str]:
    """按编号行拆分为条目正文。"""
    lines = [ln.strip() for ln in text.strip().splitlines() if ln.strip()]
    items: list[str] = []
    for ln in lines:
        m = re.match(r"^\d+\.\s*(.+)$", ln)
        items.append(m.group(1) if m else ln)
    return items


def _char_count(s: str) -> int:
    """统计汉字+标点长度（去掉空白）。"""
    return len(re.sub(r"\s+", "", s))


def validate_block(label: str, text: str, min_items: int, max_items: int) -> list[str]:
    errors: list[str] = []
    items = _split_items(text)
    if not items and text.strip():
        items = [text.strip()]
    for i, item in enumerate(items, 1):
        n = _char_count(item)
        if n < 30 or n > 60:
            errors.append(f"{label} 第{i}条字数 {n}，要求 30～60：{item[:40]}…")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description="校验日报条目字数")
    parser.add_argument("--morning", default="")
    parser.add_argument("--afternoon", default="")
    parser.add_argument("--morning-file", type=Path)
    parser.add_argument("--afternoon-file", type=Path)
    parser.add_argument("--min-total", type=int, default=4)
    parser.add_argument("--max-total", type=int, default=6)
    args = parser.parse_args()

    morning = args.morning
    afternoon = args.afternoon
    if args.morning_file and args.morning_file.exists():
        morning = args.morning_file.read_text(encoding="utf-8")
    if args.afternoon_file and args.afternoon_file.exists():
        afternoon = args.afternoon_file.read_text(encoding="utf-8")

    all_items = _split_items(morning) + _split_items(afternoon)
    errors: list[str] = []
    if len(all_items) < args.min_total or len(all_items) > args.max_total:
        errors.append(
            f"合计 {len(all_items)} 条，要求 {args.min_total}～{args.max_total} 条（上午+下午）"
        )
    errors.extend(validate_block("上午", morning, 0, 99))
    errors.extend(validate_block("下午", afternoon, 0, 99))

    if errors:
        for e in errors:
            print(f"ERROR: {e}", file=sys.stderr)
        return 1
    print(f"OK: {len(all_items)} 条，字数校验通过")
    return 0


if __name__ == "__main__":
    sys.exit(main())
