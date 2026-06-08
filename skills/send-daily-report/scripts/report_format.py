#!/usr/bin/env python3
"""日报条目合并、重编号与预览（对齐 Excel 第 102 行写法）。"""

from __future__ import annotations

import re
from typing import List


def parse_items(text: str) -> List[str]:
    """从编号列表文本解析条目正文（不含序号）。"""
    lines = [ln.strip() for ln in (text or "").strip().splitlines() if ln.strip()]
    items: List[str] = []
    for ln in lines:
        m = re.match(r"^\d+\.\s*(.+)$", ln)
        items.append(m.group(1) if m else ln)
    return items


def format_items(items: List[str]) -> str:
    """格式化为 1. xxx\\n2. xxx。"""
    return "\n".join(f"{i + 1}. {body}" for i, body in enumerate(items))


def merge_work_items(morning: str, afternoon: str) -> str:
    """上午+下午合并为 C 列连续编号列表（参考 2026.06.04 行）。"""
    combined = parse_items(morning) + parse_items(afternoon)
    return format_items(combined)


def normalize_item_style(item: str) -> str:
    """
    润色为「完成/输出/排查」开头的结果型表述（不改动未提及的事实）。
    已以这些动词开头则原样返回。
    """
    starters = ("完成", "输出", "排查", "修复", "优化", "梳理", "对接", "部署", "编写", "调整", "学习", "开")
    body = item.strip()
    if any(body.startswith(s) for s in starters):
        return body
    if any(k in body[:12] for k in ("会议", "例会", "讨论")):
        return f"完成{body}" if not body.startswith("完成") else body
    return f"完成{body}"


def polish_items(items: List[str], polish: bool = True) -> List[str]:
    if not polish:
        return items
    return [normalize_item_style(x) for x in items]


def build_preview_text(
    date_str: str,
    weekday: str,
    work: str,
    tomorrow: str,
    notes: str,
    subject: str,
    to_list: list[str],
    cc_list: list[str],
) -> str:
    """生成给用户确认的纯文本预览。"""
    t = tomorrow.strip() or "（无）"
    n = notes.strip() or "（无）"
    to_s = ", ".join(to_list) or "（未配置）"
    cc_s = ", ".join(cc_list) or "（无）"
    return f"""
========== 日报预览（请确认后再发送）==========
日期：{date_str}  {weekday}
邮件主题：{subject}
收件人：{to_s}
抄　送：{cc_s}

【今日工作】（写入 Excel C 列，连续编号）
{work.strip()}

【明日安排】
{t}

【注意事项】
{n}
==============================================
确认发送请回复：确认发送
修改请直接说明要改的第几条及内容。
""".strip()
