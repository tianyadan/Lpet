---
name: send-daily-report
description: >-
  一键生成并发送工作日报：将用户口述/草稿整理为 4～6 条（每条 30～60 字）、写入
  《田浩文-日报》格式的 xlsx、经网易邮箱（163/126/yeah）SMTP 发送（收件人/抄送/附件）。
  在用户说「发日报」「写日报」「提交日报」「日报邮件」「网易邮箱发报告」或提供今日工作
  碎事要汇总发送时使用；即使用户未点名本 skill 也应主动启用。
---

# 一键发日报（send-daily-report）

将用户输入的工作碎事 → 规范日报条目 → 追加 Excel 行 → 发邮件（含附件）。

## 前置：配置文件（仅首次）

用户需在本地创建配置（**勿提交到 git**）：

```bash
mkdir -p ~/.config/send-daily-report
cp skills/send-daily-report/references/config.example.json ~/.config/send-daily-report/config.json
# 编辑 config.json：网易邮箱账号、SMTP 授权码、收件人、抄送、xlsx 路径
```

网易邮箱须开启 SMTP，密码填 **授权码**（非登录密码）。SMTP 默认 `smtp.163.com:465`（SSL）。

## 标准工作流（必须两步：先预览，后发送）

**禁止**在未获用户明确确认（如「确认发送」「可以发了」）时执行 `--send`。

```
- [ ] 1. 读取 config.json，确认 xlsx 路径存在
- [ ] 2. 按第 102 行风格生成 4～6 条「完成/输出」式条目（见正文规则）
- [ ] 3. 运行 --preview，在对话中展示完整预览
- [ ] 4. 等待用户确认或要求修改
- [ ] 5. 用户确认后，才运行 --send（写 xlsx + 发邮件）
- [ ] 6. 发送成功后回报主题、收件人、附件、今日条目
```

### 1. 收集输入

向用户索取（可一次性粘贴）：

- **今日工作碎事**（一段话或 bullet 均可）
- 可选：**明日安排**、**注意事项**
- 可选：覆盖默认收件人/抄送/额外附件

若用户只给碎事，明日安排与注意事项留空。

### 2. 正文规则（对齐 2026.06.04 第 102 行）

参考 [references/format.md](references/format.md)。`config.json` 默认 `"excel_layout": "unified"`。

**目标**：**合计 4～6 条**，**每条 30～60 汉字**；**全部写入 Excel C 列**连续编号，D 列留空并合并 C:D。

**写法**（每条）：

- 以 `完成` / `输出` / `修复` / `优化` 开头。
- 结构：**项目或模块 + 具体动作 + 结果或价值**。
- 合并同类碎事；保留技术名词（eyun-desk、IM、WebSocket、Tauri 等）。
- 禁止编造；禁止「测试脚本」「dry-run」等非业务表述进入正式日报。

内部拟稿可仍分 `morning` / `afternoon` 思考，脚本会自动合并为 C 列 `1.…6.`。

**可选 Codex CLI**（生成时强调第 102 行风格）：

```bash
codex exec --full-auto "…合计4-6条，每条以完成/输出开头，30-60字，项目+动作+结果…"
```

### 3. 字数校验

在写入/发信前，对上午+下午中每一条（以 `\n` 分割、去掉 `数字.` 前缀）检查长度：

- 少于 30 字：补充具体动作/结果
- 多于 60 字：拆成两条或删减冗余

脚本校验（推荐）：

```bash
python3 skills/send-daily-report/scripts/validate_items.py \
  --morning-file /tmp/morning.txt \
  --afternoon-file /tmp/afternoon.txt
```

### 4. 预览（第一步，必做）

```bash
python3 skills/send-daily-report/scripts/send_daily_report.py \
  --config ~/.config/send-daily-report/config.json \
  --preview \
  --morning "1. ...\n2. ..." \
  --afternoon "3. ...\n4. ..."
```

- 终端打印完整预览；草稿保存到 `~/.config/send-daily-report/pending.json`。
- **在对话中原样展示【今日工作】列表**，请用户确认或修改第 N 条。
- **不得**在此步骤使用 `--send`。

### 5. 确认后发送（第二步）

用户明确说「确认发送」后：

```bash
python3 skills/send-daily-report/scripts/send_daily_report.py \
  --config ~/.config/send-daily-report/config.json \
  --send
```

（读取 `pending.json`；若条目有改动，重新传 `--morning` / `--afternoon` 并先 `--preview`。）

- unified 版式：C 列连续编号 + 合并 C:D；邮件正文为【今日工作】单段（见 [email-template.md](references/email-template.md)）。
- 依赖：`pip3 install openpyxl`。

### 6. 回复用户

**预览阶段**：列出今日工作 1～N 条 + 邮件收件人/主题，提示「确认后我再发送」。

**发送成功后**：主题、To、Cc、附件、Excel 行号。

失败时给出 SMTP/授权码/xlsx 路径排查提示，**不要**在聊天中粘贴授权码。

## 安全

- `config.json` 含邮箱授权码：仅放 `~/.config/send-daily-report/`，权限 `chmod 600`。
- 勿将 config 写入仓库、勿在 commit 中提交。

## 安装到其他 AI（Cursor / Claude Code）

```bash
# Cursor（个人全局）
mkdir -p ~/.cursor/skills
cp -R skills/send-daily-report ~/.cursor/skills/

# Claude Code（可选）
mkdir -p ~/.claude/skills
cp -R skills/send-daily-report ~/.claude/skills/
```

安装后重启 IDE 或新开 Agent 会话，描述里含「发日报」即可触发。

## 故障排查

| 现象 | 处理 |
|------|------|
| SMTP 535 认证失败 | 确认授权码、完整邮箱账号、163 已开 SMTP |
| 连接超时 | 检查 465/SSL；企业网络是否拦 SMTP |
| openpyxl 缺失 | `pip3 install openpyxl` |
| sheet 找不到 | 在 config 设置 `active_sheet` 为 `2026` 等年份 sheet 名 |

## 参考文件

- [references/format.md](references/format.md) — Excel 列与示例语气
- [references/config.example.json](references/config.example.json) — 配置模板
- [references/email-template.md](references/email-template.md) — 邮件正文模板
