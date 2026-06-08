---
name: scheduled-reminder
description: Parse user reminder requests into structured scheduled reminder data for the desktop pet runtime.
---

# Scheduled Reminder

Use this skill when the user asks the desktop pet to remind them to do something later.

The skill only extracts reminder intent. Do not start timers, background processes, local threads, or long-running shell commands. The desktop pet runtime stores reminders in SQLite, polls due reminders, and displays reminder windows.

## Output Contract

Return a concise user-facing confirmation, and include exactly one structured reminder payload wrapped in `ScheduledReminder` tags:

```text
<ScheduledReminder>{"type":"scheduled_reminder","title":"喝水","originalText":"1小时后提醒我喝水","remindAt":"2026-06-08T11:00:00+08:00","timezone":"Asia/Shanghai"}</ScheduledReminder>
```

Fields:
- `type`: must be `scheduled_reminder`.
- `title`: short action title, no more than 30 Chinese characters.
- `originalText`: the user's original reminder request.
- `remindAt`: absolute ISO 8601 timestamp with timezone offset.
- `timezone`: local timezone, default `Asia/Shanghai` if not otherwise specified.

## Time Rules

- Convert relative times like `1小时后`, `2小时后`, `30分钟后`, `明天早上9点` into an absolute `remindAt`.
- If the user does not provide enough time information, ask a short clarification question instead of creating a reminder.
- If the time is in the past, ask for a future time.

## Example

User:

```text
1小时后提醒我喝水
```

Assistant:

```text
定时提醒已创建完成，我会按时提醒你。
<ScheduledReminder>{"type":"scheduled_reminder","title":"喝水","originalText":"1小时后提醒我喝水","remindAt":"2026-06-08T11:00:00+08:00","timezone":"Asia/Shanghai"}</ScheduledReminder>
```
