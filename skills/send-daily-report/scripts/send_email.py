#!/usr/bin/env python3
"""通过网易等 SMTP SSL 发送邮件（收件人、抄送、多附件）。"""

from __future__ import annotations

import argparse
import json
import mimetypes
import smtplib
import sys
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr
from pathlib import Path


def _load_config(path: Path) -> dict:
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def _build_message(
    cfg: dict,
    subject: str,
    body: str,
    attachments: list[Path],
) -> MIMEMultipart:
    smtp_cfg = cfg["smtp"]
    mail_cfg = cfg["mail"]
    from_addr = smtp_cfg["username"]
    from_name = cfg.get("from_name", "")

    msg = MIMEMultipart()
    msg["From"] = formataddr((from_name, from_addr)) if from_name else from_addr
    msg["To"] = ", ".join(mail_cfg.get("to", []))
    cc = mail_cfg.get("cc", [])
    if cc:
        msg["Cc"] = ", ".join(cc)
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "plain", "utf-8"))

    for path in attachments:
        if not path.exists():
            raise FileNotFoundError(path)
        mime, _ = mimetypes.guess_type(str(path))
        if mime is None:
            mime = "application/octet-stream"
        maintype, subtype = mime.split("/", 1)
        with path.open("rb") as f:
            part = MIMEApplication(f.read(), _subtype=subtype)
        part.add_header("Content-Disposition", "attachment", filename=path.name)
        msg.attach(part)

    return msg


def main() -> int:
    parser = argparse.ArgumentParser(description="SMTP 发送日报邮件")
    parser.add_argument("--config", required=True, type=Path)
    parser.add_argument("--subject", required=True)
    parser.add_argument("--body", default="")
    parser.add_argument("--body-file", type=Path)
    parser.add_argument("--attach", action="append", default=[], help="可多次指定")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    cfg = _load_config(args.config)
    body = args.body
    if args.body_file:
        body = args.body_file.read_text(encoding="utf-8")

    attachments = [Path(p).expanduser() for p in args.attach]
    msg = _build_message(cfg, args.subject, body, attachments)

    recipients = list(cfg["mail"].get("to", [])) + list(cfg["mail"].get("cc", []))
    smtp_cfg = cfg["smtp"]
    host = smtp_cfg["host"]
    port = int(smtp_cfg.get("port", 465))
    use_ssl = smtp_cfg.get("use_ssl", True)

    if args.dry_run:
        print(f"[dry-run] To={msg['To']} Cc={msg.get('Cc','')} Subject={args.subject}")
        print(f"[dry-run] Attachments: {[p.name for p in attachments]}")
        return 0

    try:
        if use_ssl:
            server = smtplib.SMTP_SSL(host, port, timeout=30)
        else:
            server = smtplib.SMTP(host, port, timeout=30)
            server.starttls()
        server.login(smtp_cfg["username"], smtp_cfg["password"])
        server.sendmail(smtp_cfg["username"], recipients, msg.as_string())
        server.quit()
    except smtplib.SMTPException as e:
        print(f"SMTP 失败: {e}", file=sys.stderr)
        return 1

    print(f"已发送 → {', '.join(recipients)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
