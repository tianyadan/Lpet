#!/usr/bin/env bash
# 将 send-daily-report 安装到 Cursor / Claude Code 技能目录
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"

install_to() {
  local dest="$1"
  mkdir -p "$(dirname "$dest")"
  rm -rf "$dest"
  cp -R "$ROOT" "$dest"
  echo "installed → $dest"
}

install_to "${HOME}/.cursor/skills/send-daily-report"
install_to "${HOME}/.claude/skills/send-daily-report"

CONFIG_DIR="${HOME}/.config/send-daily-report"
mkdir -p "$CONFIG_DIR"
if [[ ! -f "${CONFIG_DIR}/config.json" ]]; then
  cp "${ROOT}/references/config.example.json" "${CONFIG_DIR}/config.json"
  chmod 600 "${CONFIG_DIR}/config.json"
  echo "已创建配置模板 → ${CONFIG_DIR}/config.json （请填写网易授权码与收件人）"
else
  echo "保留已有配置 → ${CONFIG_DIR}/config.json"
fi

echo ""
echo "依赖: pip3 install -r ${ROOT}/scripts/requirements.txt"
echo "完成后重启 Cursor / 新开 Agent 会话即可使用。"
