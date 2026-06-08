#!/usr/bin/env python3
"""一键：校验 → 预览/确认 → 写 xlsx → 发邮件。"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
from datetime import datetime
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
PENDING_FILE = Path.home() / ".config/send-daily-report/pending.json"

sys.path.insert(0, str(SCRIPT_DIR))
from report_format import (  # noqa: E402
    build_preview_text,
    merge_work_items,
    parse_items,
    polish_items,
    format_items,
)

WEEKDAY_CN = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]


def _run(cmd: list[str]) -> int:
    print("$", " ".join(cmd))
    return subprocess.call(cmd)


def _today() -> tuple[str, str]:
    now = datetime.now()
    return now.strftime("%Y.%m.%d"), WEEKDAY_CN[now.weekday()]


def _is_unified_layout(cfg: dict) -> bool:
    return cfg.get("excel_layout", "unified") != "split"


def _prepare_work(morning: str, afternoon: str, cfg: dict) -> tuple[str, str, str]:
    """返回 (excel_morning, excel_afternoon, unified_work)。"""
    items = polish_items(parse_items(morning) + parse_items(afternoon))
    work = format_items(items)
    if _is_unified_layout(cfg):
        return work, "", work
    # split：上午 1-2 条，下午其余
    mid = max(1, len(items) // 2)
    am = format_items(items[:mid])
    pm = format_items(items[mid:])
    return am, pm, work


def _build_email_body(cfg: dict, work: str, tomorrow: str, notes: str) -> str:
    name = cfg.get("reporter_display_name", "")
    t = tomorrow.strip() or "无"
    n = notes.strip() or "无"
    return f"""各位好，

以下为本人今日工作汇报，详细记录见附件 Excel。

【今日工作】
{work.strip()}

【明日安排】
{t}

【注意事项】
{n}

此致
{name}
"""


def _save_pending(payload: dict) -> None:
    PENDING_FILE.parent.mkdir(parents=True, exist_ok=True)
    PENDING_FILE.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"已保存待发送草稿 → {PENDING_FILE}")


def _load_pending() -> dict | None:
    if not PENDING_FILE.exists():
        return None
    return json.loads(PENDING_FILE.read_text(encoding="utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser(description="一键发日报")
    parser.add_argument("--config", required=True, type=Path)
    parser.add_argument("--morning", default="")
    parser.add_argument("--afternoon", default="")
    parser.add_argument("--tomorrow", default="")
    parser.add_argument("--notes", default="")
    parser.add_argument("--subject", default="")
    parser.add_argument("--skip-validate", action="store_true")
    parser.add_argument(
        "--preview",
        action="store_true",
        help="仅生成预览并保存草稿（默认行为，除非指定 --send）",
    )
    parser.add_argument(
        "--send",
        action="store_true",
        help="用户确认后：写入 xlsx 并发送（可用 pending.json）",
    )
    parser.add_argument("--dry-run", action="store_true", help="与 --send 联用：真写 xlsx，邮件仅预览")
    parser.add_argument("--extra-attach", action="append", default=[])
    args = parser.parse_args()

    cfg_path = args.config.expanduser()
    with cfg_path.open(encoding="utf-8") as f:
        cfg = json.load(f)

    pending = _load_pending() if args.send and not (args.morning or args.afternoon) else None
    if pending:
        morning = pending.get("morning", "")
        afternoon = pending.get("afternoon", "")
        tomorrow = pending.get("tomorrow", args.tomorrow)
        notes = pending.get("notes", args.notes)
    else:
        morning = args.morning
        afternoon = args.afternoon
        tomorrow = args.tomorrow
        notes = args.notes

    if not morning and not afternoon:
        print("请提供 --morning / --afternoon，或先运行 --preview 生成 pending.json", file=sys.stderr)
        return 1

    excel_morning, excel_afternoon, work = _prepare_work(morning, afternoon, cfg)
    date_str, weekday = _today()
    date_label = datetime.now().strftime("%Y-%m-%d")
    prefix = cfg.get("mail", {}).get("default_subject_prefix", "工作日报")
    name = cfg.get("reporter_display_name", "")
    subject = args.subject or f"{prefix} {date_label} {name}".strip()

    do_preview = args.preview or not args.send
    do_send = args.send

    py = sys.executable
    if not args.skip_validate:
        code = _run(
            [
                py,
                str(SCRIPT_DIR / "validate_items.py"),
                "--morning",
                excel_morning if _is_unified_layout(cfg) else morning,
                "--afternoon",
                "" if _is_unified_layout(cfg) else afternoon,
            ]
        )
        if code != 0:
            return code

    mail_cfg = cfg.get("mail", {})
    preview = build_preview_text(
        date_str,
        weekday,
        work,
        tomorrow,
        notes,
        subject,
        mail_cfg.get("to", []),
        mail_cfg.get("cc", []),
    )
    print(preview)

    payload = {
        "morning": morning,
        "afternoon": afternoon,
        "excel_morning": excel_morning,
        "excel_afternoon": excel_afternoon,
        "work": work,
        "tomorrow": tomorrow,
        "notes": notes,
        "subject": subject,
    }
    _save_pending(payload)

    if do_preview and not do_send:
        print("\n[preview] 未发送。用户确认后请使用: --send")
        return 0

    if not do_send:
        return 0

    code = _run(
        [
            py,
            str(SCRIPT_DIR / "update_daily_report.py"),
            "--config",
            str(cfg_path),
            "--morning",
            excel_morning,
            "--afternoon",
            excel_afternoon,
            "--tomorrow",
            tomorrow,
            "--notes",
            notes,
            "--merge-cd" if _is_unified_layout(cfg) else "--no-merge-cd",
        ]
    )
    if code != 0:
        return code

    xlsx = Path(cfg["xlsx_path"]).expanduser()
    body = _build_email_body(cfg, work, tomorrow, notes)
    with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False, encoding="utf-8") as tf:
        tf.write(body)
        body_file = tf.name

    cmd = [
        py,
        str(SCRIPT_DIR / "send_email.py"),
        "--config",
        str(cfg_path),
        "--subject",
        subject,
        "--body-file",
        body_file,
        "--attach",
        str(xlsx),
    ]
    for extra in args.extra_attach:
        cmd.extend(["--attach", extra])
    if args.dry_run:
        cmd.append("--dry-run")

    code = _run(cmd)
    if code == 0 and not args.dry_run:
        print("\n[send] 已发送。如需修改今日行请重新运行并覆盖。")
    return code


if __name__ == "__main__":
    sys.exit(main())
