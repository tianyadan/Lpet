import { app } from 'electron';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
const defaultTranslationConfig = {
    targetLanguage: 'english',
    shortcut: 'Control+Shift+T',
    updatedAt: '',
};
const defaultPetIdentity = {
    name: '',
    owner: '',
    age: '',
    hobbies: '',
    gender: 'other',
    bio: '',
    updatedAt: '',
};
const supportedModelProviders = ['qwen', 'deepseek'];
function createEmptyModelProviderConfig(provider) {
    return {
        provider,
        apiKey: '',
        languageModelName: '',
        visionModelName: '',
        lastTestStatus: 'unknown',
        lastTestMessage: '',
        languageTestStatus: 'unknown',
        languageTestMessage: '',
        languageTestedAt: '',
        visionTestStatus: 'unknown',
        visionTestMessage: '',
        visionTestedAt: '',
        updatedAt: '',
        testedAt: '',
    };
}
function toPublicModelProviderConfig(config) {
    return {
        provider: config.provider,
        hasApiKey: config.apiKey.length > 0,
        languageModelName: config.languageModelName,
        visionModelName: config.visionModelName,
        configured: config.apiKey.length > 0 && config.languageModelName.length > 0,
        lastTestStatus: config.lastTestStatus,
        lastTestMessage: config.lastTestMessage,
        languageTestStatus: config.languageTestStatus,
        languageTestMessage: config.languageTestMessage,
        languageTestedAt: config.languageTestedAt,
        visionTestStatus: config.visionTestStatus,
        visionTestMessage: config.visionTestMessage,
        visionTestedAt: config.visionTestedAt,
        updatedAt: config.updatedAt,
        testedAt: config.testedAt,
    };
}
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

      CREATE TABLE IF NOT EXISTS pet_identity (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        name TEXT NOT NULL DEFAULT '',
        owner TEXT NOT NULL DEFAULT '',
        age TEXT NOT NULL DEFAULT '',
        hobbies TEXT NOT NULL DEFAULT '',
        gender TEXT NOT NULL DEFAULT 'other',
        bio TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL DEFAULT ''
      );

      CREATE TABLE IF NOT EXISTS model_provider_configs (
        provider TEXT PRIMARY KEY,
        api_key TEXT NOT NULL DEFAULT '',
        model_name TEXT NOT NULL DEFAULT '',
        language_model_name TEXT NOT NULL DEFAULT '',
        vision_model_name TEXT NOT NULL DEFAULT '',
        last_test_status TEXT NOT NULL DEFAULT 'unknown',
        last_test_message TEXT NOT NULL DEFAULT '',
        language_test_status TEXT NOT NULL DEFAULT 'unknown',
        language_test_message TEXT NOT NULL DEFAULT '',
        language_tested_at TEXT NOT NULL DEFAULT '',
        vision_test_status TEXT NOT NULL DEFAULT 'unknown',
        vision_test_message TEXT NOT NULL DEFAULT '',
        vision_tested_at TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL DEFAULT '',
        tested_at TEXT NOT NULL DEFAULT ''
      );

      CREATE TABLE IF NOT EXISTS reminder_tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        original_text TEXT NOT NULL,
        remind_at TEXT NOT NULL,
        timezone TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'pending',
        snooze_until TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        fired_at TEXT NOT NULL DEFAULT ''
      );

      CREATE INDEX IF NOT EXISTS idx_reminder_tasks_due
        ON reminder_tasks(status, remind_at);

      CREATE TABLE IF NOT EXISTS translation_config (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        target_language TEXT NOT NULL DEFAULT 'english',
        shortcut TEXT NOT NULL DEFAULT 'Control+Shift+T',
        updated_at TEXT NOT NULL DEFAULT ''
      );
    `);
        this.migrateModelProviderSchema();
    }
    migrateModelProviderSchema() {
        if (!this.database) {
            return;
        }
        const columns = new Set(this.database
            .prepare('PRAGMA table_info(model_provider_configs)')
            .all().map((column) => column.name));
        const addColumnStatements = [
            ['language_model_name', "ALTER TABLE model_provider_configs ADD COLUMN language_model_name TEXT NOT NULL DEFAULT ''"],
            ['vision_model_name', "ALTER TABLE model_provider_configs ADD COLUMN vision_model_name TEXT NOT NULL DEFAULT ''"],
            ['language_test_status', "ALTER TABLE model_provider_configs ADD COLUMN language_test_status TEXT NOT NULL DEFAULT 'unknown'"],
            ['language_test_message', "ALTER TABLE model_provider_configs ADD COLUMN language_test_message TEXT NOT NULL DEFAULT ''"],
            ['language_tested_at', "ALTER TABLE model_provider_configs ADD COLUMN language_tested_at TEXT NOT NULL DEFAULT ''"],
            ['vision_test_status', "ALTER TABLE model_provider_configs ADD COLUMN vision_test_status TEXT NOT NULL DEFAULT 'unknown'"],
            ['vision_test_message', "ALTER TABLE model_provider_configs ADD COLUMN vision_test_message TEXT NOT NULL DEFAULT ''"],
            ['vision_tested_at', "ALTER TABLE model_provider_configs ADD COLUMN vision_tested_at TEXT NOT NULL DEFAULT ''"],
        ];
        for (const [columnName, statement] of addColumnStatements) {
            if (!columns.has(columnName)) {
                this.database.exec(statement);
            }
        }
        // WHY：旧版本只有 model_name/last_test_status，升级后保留用户已有配置，避免重新输入。
        if (columns.has('model_name')) {
            this.database.exec(`
        UPDATE model_provider_configs
        SET
          language_model_name = CASE WHEN language_model_name = '' THEN model_name ELSE language_model_name END,
          language_test_status = CASE WHEN language_test_status = 'unknown' THEN last_test_status ELSE language_test_status END,
          language_test_message = CASE WHEN language_test_message = '' THEN last_test_message ELSE language_test_message END,
          language_tested_at = CASE WHEN language_tested_at = '' THEN tested_at ELSE language_tested_at END
      `);
        }
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
    getPetIdentity() {
        if (!this.database) {
            return defaultPetIdentity;
        }
        const record = this.database
            .prepare(`
        SELECT
          name,
          owner,
          age,
          hobbies,
          gender,
          bio,
          updated_at AS updatedAt
        FROM pet_identity
        WHERE id = 1
      `)
            .get();
        if (!record) {
            return defaultPetIdentity;
        }
        return {
            name: typeof record.name === 'string' ? record.name : '',
            owner: typeof record.owner === 'string' ? record.owner : '',
            age: typeof record.age === 'string' ? record.age : '',
            hobbies: typeof record.hobbies === 'string' ? record.hobbies : '',
            gender: record.gender === 'male' || record.gender === 'female' || record.gender === 'other' ? record.gender : 'other',
            bio: typeof record.bio === 'string' ? record.bio : '',
            updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : '',
        };
    }
    savePetIdentity(identity) {
        const nextIdentity = {
            ...identity,
            updatedAt: new Date().toISOString(),
        };
        if (!this.database) {
            return nextIdentity;
        }
        this.database
            .prepare(`
        INSERT INTO pet_identity (
          id,
          name,
          owner,
          age,
          hobbies,
          gender,
          bio,
          updated_at
        )
        VALUES (1, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          owner = excluded.owner,
          age = excluded.age,
          hobbies = excluded.hobbies,
          gender = excluded.gender,
          bio = excluded.bio,
          updated_at = excluded.updated_at
      `)
            .run(nextIdentity.name, nextIdentity.owner, nextIdentity.age, nextIdentity.hobbies, nextIdentity.gender, nextIdentity.bio, nextIdentity.updatedAt);
        return nextIdentity;
    }
    listModelProviderConfigs() {
        return supportedModelProviders.map((provider) => toPublicModelProviderConfig(this.getModelProviderConfig(provider)));
    }
    getModelProviderConfig(provider) {
        if (!this.database) {
            return createEmptyModelProviderConfig(provider);
        }
        const record = this.database
            .prepare(`
        SELECT
          provider,
          api_key AS apiKey,
          language_model_name AS languageModelName,
          vision_model_name AS visionModelName,
          last_test_status AS lastTestStatus,
          last_test_message AS lastTestMessage,
          language_test_status AS languageTestStatus,
          language_test_message AS languageTestMessage,
          language_tested_at AS languageTestedAt,
          vision_test_status AS visionTestStatus,
          vision_test_message AS visionTestMessage,
          vision_tested_at AS visionTestedAt,
          updated_at AS updatedAt,
          tested_at AS testedAt
        FROM model_provider_configs
        WHERE provider = ?
      `)
            .get(provider);
        if (!record) {
            return createEmptyModelProviderConfig(provider);
        }
        const lastTestStatus = record.lastTestStatus === 'success' || record.lastTestStatus === 'failed' || record.lastTestStatus === 'unknown'
            ? record.lastTestStatus
            : 'unknown';
        const languageTestStatus = record.languageTestStatus === 'success' || record.languageTestStatus === 'failed' || record.languageTestStatus === 'unknown'
            ? record.languageTestStatus
            : lastTestStatus;
        const visionTestStatus = record.visionTestStatus === 'success' || record.visionTestStatus === 'failed' || record.visionTestStatus === 'unknown'
            ? record.visionTestStatus
            : 'unknown';
        return {
            provider,
            apiKey: typeof record.apiKey === 'string' ? record.apiKey : '',
            languageModelName: typeof record.languageModelName === 'string' ? record.languageModelName : '',
            visionModelName: typeof record.visionModelName === 'string' ? record.visionModelName : '',
            lastTestStatus,
            lastTestMessage: typeof record.lastTestMessage === 'string' ? record.lastTestMessage : '',
            languageTestStatus,
            languageTestMessage: typeof record.languageTestMessage === 'string' ? record.languageTestMessage : '',
            languageTestedAt: typeof record.languageTestedAt === 'string' ? record.languageTestedAt : '',
            visionTestStatus,
            visionTestMessage: typeof record.visionTestMessage === 'string' ? record.visionTestMessage : '',
            visionTestedAt: typeof record.visionTestedAt === 'string' ? record.visionTestedAt : '',
            updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : '',
            testedAt: typeof record.testedAt === 'string' ? record.testedAt : '',
        };
    }
    saveModelProviderConfig(input) {
        const currentConfig = this.getModelProviderConfig(input.provider);
        const nextConfig = {
            provider: input.provider,
            // WHY：前端为了安全不会回显 API Key；用户留空保存时必须保留旧密钥，避免首页状态灯被误判为未配置。
            apiKey: typeof input.apiKey === 'string' && input.apiKey.trim() ? input.apiKey.trim() : currentConfig.apiKey,
            languageModelName: input.languageModelName.trim(),
            visionModelName: typeof input.visionModelName === 'string' ? input.visionModelName.trim() : currentConfig.visionModelName,
            lastTestStatus: input.lastTestStatus ?? currentConfig.lastTestStatus,
            lastTestMessage: input.lastTestMessage ?? currentConfig.lastTestMessage,
            languageTestStatus: input.languageTestStatus ?? currentConfig.languageTestStatus,
            languageTestMessage: input.lastTestMessage ?? currentConfig.languageTestMessage,
            languageTestedAt: input.testedAt ?? currentConfig.languageTestedAt,
            visionTestStatus: input.visionTestStatus ?? currentConfig.visionTestStatus,
            visionTestMessage: input.visionTestMessage ?? currentConfig.visionTestMessage,
            visionTestedAt: input.visionTestedAt ?? currentConfig.visionTestedAt,
            updatedAt: new Date().toISOString(),
            testedAt: input.testedAt ?? currentConfig.testedAt,
        };
        if (!this.database) {
            return toPublicModelProviderConfig(nextConfig);
        }
        this.database
            .prepare(`
        INSERT INTO model_provider_configs (
          provider,
          api_key,
          model_name,
          language_model_name,
          vision_model_name,
          last_test_status,
          last_test_message,
          language_test_status,
          language_test_message,
          language_tested_at,
          vision_test_status,
          vision_test_message,
          vision_tested_at,
          updated_at,
          tested_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(provider) DO UPDATE SET
          api_key = excluded.api_key,
          model_name = excluded.model_name,
          language_model_name = excluded.language_model_name,
          vision_model_name = excluded.vision_model_name,
          last_test_status = excluded.last_test_status,
          last_test_message = excluded.last_test_message,
          language_test_status = excluded.language_test_status,
          language_test_message = excluded.language_test_message,
          language_tested_at = excluded.language_tested_at,
          vision_test_status = excluded.vision_test_status,
          vision_test_message = excluded.vision_test_message,
          vision_tested_at = excluded.vision_tested_at,
          updated_at = excluded.updated_at,
          tested_at = excluded.tested_at
      `)
            .run(nextConfig.provider, nextConfig.apiKey, nextConfig.languageModelName, nextConfig.languageModelName, nextConfig.visionModelName, nextConfig.lastTestStatus, nextConfig.lastTestMessage, nextConfig.languageTestStatus, nextConfig.languageTestMessage, nextConfig.languageTestedAt, nextConfig.visionTestStatus, nextConfig.visionTestMessage, nextConfig.visionTestedAt, nextConfig.updatedAt, nextConfig.testedAt);
        return toPublicModelProviderConfig(nextConfig);
    }
    createReminderTask(input) {
        const now = new Date().toISOString();
        const task = {
            id: randomUUID(),
            title: input.title.trim(),
            originalText: input.originalText.trim(),
            remindAt: input.remindAt,
            timezone: input.timezone.trim(),
            status: 'pending',
            snoozeUntil: '',
            createdAt: now,
            updatedAt: now,
            firedAt: '',
        };
        if (!this.database) {
            return task;
        }
        this.database
            .prepare(`
        INSERT INTO reminder_tasks (
          id,
          title,
          original_text,
          remind_at,
          timezone,
          status,
          snooze_until,
          created_at,
          updated_at,
          fired_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
            .run(task.id, task.title, task.originalText, task.remindAt, task.timezone, task.status, task.snoozeUntil, task.createdAt, task.updatedAt, task.firedAt);
        return task;
    }
    getReminderTask(id) {
        if (!this.database) {
            return null;
        }
        const record = this.database
            .prepare(`
        SELECT
          id,
          title,
          original_text AS originalText,
          remind_at AS remindAt,
          timezone,
          status,
          snooze_until AS snoozeUntil,
          created_at AS createdAt,
          updated_at AS updatedAt,
          fired_at AS firedAt
        FROM reminder_tasks
        WHERE id = ?
      `)
            .get(id);
        return record ?? null;
    }
    listDueReminderTasks(nowIso) {
        if (!this.database) {
            return [];
        }
        return this.database
            .prepare(`
        SELECT
          id,
          title,
          original_text AS originalText,
          remind_at AS remindAt,
          timezone,
          status,
          snooze_until AS snoozeUntil,
          created_at AS createdAt,
          updated_at AS updatedAt,
          fired_at AS firedAt
        FROM reminder_tasks
        WHERE status = 'pending'
          AND remind_at <= ?
        ORDER BY remind_at ASC
        LIMIT 5
      `)
            .all(nowIso);
    }
    markReminderFired(id) {
        if (!this.database) {
            return;
        }
        const now = new Date().toISOString();
        this.database
            .prepare(`
        UPDATE reminder_tasks
        SET status = 'fired',
            fired_at = ?,
            updated_at = ?
        WHERE id = ?
          AND status = 'pending'
      `)
            .run(now, now, id);
    }
    completeReminderTask(id) {
        if (!this.database) {
            return null;
        }
        const now = new Date().toISOString();
        this.database
            .prepare(`
        UPDATE reminder_tasks
        SET status = 'done',
            updated_at = ?
        WHERE id = ?
      `)
            .run(now, id);
        return this.getReminderTask(id);
    }
    snoozeReminderTask(id, remindAt) {
        if (!this.database) {
            return null;
        }
        const now = new Date().toISOString();
        this.database
            .prepare(`
        UPDATE reminder_tasks
        SET status = 'pending',
            remind_at = ?,
            snooze_until = ?,
            updated_at = ?,
            fired_at = ''
        WHERE id = ?
      `)
            .run(remindAt, remindAt, now, id);
        return this.getReminderTask(id);
    }
    getTranslationConfig() {
        if (!this.database) {
            return defaultTranslationConfig;
        }
        const record = this.database
            .prepare(`
        SELECT
          target_language AS targetLanguage,
          shortcut,
          updated_at AS updatedAt
        FROM translation_config
        WHERE id = 1
      `)
            .get();
        if (!record) {
            return defaultTranslationConfig;
        }
        const targetLanguage = record.targetLanguage === 'english' ||
            record.targetLanguage === 'chinese' ||
            record.targetLanguage === 'russian' ||
            record.targetLanguage === 'french' ||
            record.targetLanguage === 'japanese' ||
            record.targetLanguage === 'italian'
            ? record.targetLanguage
            : defaultTranslationConfig.targetLanguage;
        return {
            targetLanguage,
            shortcut: typeof record.shortcut === 'string' && record.shortcut.trim() ? record.shortcut.trim() : defaultTranslationConfig.shortcut,
            updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : '',
        };
    }
    saveTranslationConfig(input) {
        const currentConfig = this.getTranslationConfig();
        const targetLanguage = input.targetLanguage === 'english' ||
            input.targetLanguage === 'chinese' ||
            input.targetLanguage === 'russian' ||
            input.targetLanguage === 'french' ||
            input.targetLanguage === 'japanese' ||
            input.targetLanguage === 'italian'
            ? input.targetLanguage
            : currentConfig.targetLanguage;
        const shortcut = typeof input.shortcut === 'string' && input.shortcut.trim() ? input.shortcut.trim().slice(0, 80) : currentConfig.shortcut;
        const nextConfig = {
            targetLanguage,
            shortcut,
            updatedAt: new Date().toISOString(),
        };
        if (!this.database) {
            return nextConfig;
        }
        this.database
            .prepare(`
        INSERT INTO translation_config (
          id,
          target_language,
          shortcut,
          updated_at
        )
        VALUES (1, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          target_language = excluded.target_language,
          shortcut = excluded.shortcut,
          updated_at = excluded.updated_at
      `)
            .run(nextConfig.targetLanguage, nextConfig.shortcut, nextConfig.updatedAt);
        return nextConfig;
    }
}
