import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
export class InteractionHistoryService {
    database = null;
    init() {
        const userDataPath = app.getPath('userData');
        fs.mkdirSync(userDataPath, { recursive: true });
        this.database = new DatabaseSync(path.join(userDataPath, 'pet.db'));
        this.database.exec(`
      CREATE TABLE IF NOT EXISTS interaction_records (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        user_prompt TEXT NOT NULL,
        assistant_reply TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL,
        session_id TEXT,
        cwd TEXT NOT NULL,
        started_at TEXT NOT NULL,
        ended_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_interaction_records_started_at
        ON interaction_records(started_at DESC);

      CREATE VIRTUAL TABLE IF NOT EXISTS interaction_records_fts USING fts5(
        user_prompt,
        assistant_reply,
        content='interaction_records',
        content_rowid='rowid'
      );

      CREATE TRIGGER IF NOT EXISTS interaction_records_ai AFTER INSERT ON interaction_records BEGIN
        INSERT INTO interaction_records_fts(rowid, user_prompt, assistant_reply)
        VALUES (new.rowid, new.user_prompt, new.assistant_reply);
      END;
    `);
    }
    insert(record) {
        if (!this.database) {
            return;
        }
        this.database
            .prepare(`
        INSERT INTO interaction_records (
          id,
          provider,
          user_prompt,
          assistant_reply,
          status,
          session_id,
          cwd,
          started_at,
          ended_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
            .run(record.id, record.provider, record.userPrompt, record.assistantReply, record.status, record.sessionId, record.cwd, record.startedAt, record.endedAt);
    }
    listRecent(limit) {
        if (!this.database) {
            return [];
        }
        return this.database
            .prepare(`
        SELECT
          id,
          provider,
          user_prompt AS userPrompt,
          assistant_reply AS assistantReply,
          status,
          session_id AS sessionId,
          cwd,
          started_at AS startedAt,
          ended_at AS endedAt
        FROM interaction_records
        ORDER BY started_at DESC
        LIMIT ?
      `)
            .all(limit);
    }
}
