import { app } from 'electron';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export interface InteractionRecordInput {
  id: string;
  provider: string;
  userPrompt: string;
  assistantReply: string;
  status: 'success' | 'failed' | 'cancelled';
  sessionId: string | null;
  cwd: string;
  startedAt: string;
  endedAt: string;
}

export interface InteractionRecord {
  id: string;
  provider: string;
  userPrompt: string;
  assistantReply: string;
  status: string;
  sessionId: string | null;
  cwd: string;
  startedAt: string;
  endedAt: string;
}

export interface PetIdentity {
  name: string;
  owner: string;
  age: string;
  hobbies: string;
  gender: 'male' | 'female' | 'other';
  bio: string;
  updatedAt: string;
}

export type ModelProviderId = 'qwen' | 'deepseek';
export type ModelProviderTestStatus = 'unknown' | 'success' | 'failed';

export interface ModelProviderConfigInput {
  provider: ModelProviderId;
  apiKey?: string;
  languageModelName: string;
  visionModelName?: string;
  lastTestStatus?: ModelProviderTestStatus;
  lastTestMessage?: string;
  testedAt?: string;
  languageTestStatus?: ModelProviderTestStatus;
  visionTestStatus?: ModelProviderTestStatus;
  visionTestMessage?: string;
  visionTestedAt?: string;
}

export interface ModelProviderConfig {
  provider: ModelProviderId;
  apiKey: string;
  languageModelName: string;
  visionModelName: string;
  lastTestStatus: ModelProviderTestStatus;
  lastTestMessage: string;
  languageTestStatus: ModelProviderTestStatus;
  languageTestMessage: string;
  languageTestedAt: string;
  visionTestStatus: ModelProviderTestStatus;
  visionTestMessage: string;
  visionTestedAt: string;
  updatedAt: string;
  testedAt: string;
}

export interface PublicModelProviderConfig {
  provider: ModelProviderId;
  hasApiKey: boolean;
  languageModelName: string;
  visionModelName: string;
  configured: boolean;
  lastTestStatus: ModelProviderTestStatus;
  lastTestMessage: string;
  languageTestStatus: ModelProviderTestStatus;
  languageTestMessage: string;
  languageTestedAt: string;
  visionTestStatus: ModelProviderTestStatus;
  visionTestMessage: string;
  visionTestedAt: string;
  updatedAt: string;
  testedAt: string;
}

export type ReminderTaskStatus = 'pending' | 'fired' | 'done' | 'cancelled';

export interface ReminderTaskInput {
  title: string;
  originalText: string;
  remindAt: string;
  timezone: string;
}

export interface ReminderTaskUpdateInput {
  id: string;
  title: string;
  remindAt: string;
  originalText?: string;
  timezone?: string;
}

export interface ReminderTask {
  id: string;
  title: string;
  originalText: string;
  remindAt: string;
  timezone: string;
  status: ReminderTaskStatus;
  snoozeUntil: string;
  createdAt: string;
  updatedAt: string;
  firedAt: string;
}

export type TranslationTargetLanguage = 'english' | 'chinese' | 'russian' | 'french' | 'japanese' | 'italian';

export interface TranslationConfig {
  targetLanguage: TranslationTargetLanguage;
  shortcut: string;
  updatedAt: string;
}

export type GitActivityEventType = 'commit' | 'push';

export interface GitActivityConfig {
  enabled: boolean;
  translateCommit: boolean;
  summaryTime: string;
  updatedAt: string;
}

export interface GitActivityEvent {
  id: string;
  eventType: GitActivityEventType;
  repoPath: string;
  branch: string;
  remote: string;
  commitHash: string;
  commitMessage: string;
  translatedMessage: string;
  createdAt: string;
  notifiedAt: string;
}

export interface GitActivityStats {
  date: string;
  commitCount: number;
  pushCount: number;
  repoCount: number;
}

const defaultTranslationConfig: TranslationConfig = {
  targetLanguage: 'english',
  shortcut: 'Control+Shift+T',
  updatedAt: '',
};

const defaultGitActivityConfig: GitActivityConfig = {
  enabled: false,
  translateCommit: false,
  summaryTime: '20:00',
  updatedAt: '',
};

const defaultPetIdentity: PetIdentity = {
  name: '',
  owner: '',
  age: '',
  hobbies: '',
  gender: 'other',
  bio: '',
  updatedAt: '',
};

const supportedModelProviders: ModelProviderId[] = ['qwen', 'deepseek'];

function createEmptyModelProviderConfig(provider: ModelProviderId): ModelProviderConfig {
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

function toPublicModelProviderConfig(config: ModelProviderConfig): PublicModelProviderConfig {
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
  private database: DatabaseSync | null = null;

  init(): void {
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

      CREATE TABLE IF NOT EXISTS git_activity_config (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        enabled INTEGER NOT NULL DEFAULT 0,
        translate_commit INTEGER NOT NULL DEFAULT 0,
        summary_time TEXT NOT NULL DEFAULT '20:00',
        updated_at TEXT NOT NULL DEFAULT ''
      );

      CREATE TABLE IF NOT EXISTS git_activity_events (
        id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        repo_path TEXT NOT NULL,
        branch TEXT NOT NULL DEFAULT '',
        remote TEXT NOT NULL DEFAULT '',
        commit_hash TEXT NOT NULL DEFAULT '',
        commit_message TEXT NOT NULL DEFAULT '',
        translated_message TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        notified_at TEXT NOT NULL DEFAULT ''
      );

      CREATE INDEX IF NOT EXISTS idx_git_activity_events_created_at
        ON git_activity_events(created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_git_activity_events_notified
        ON git_activity_events(notified_at, created_at);
    `);
    this.migrateModelProviderSchema();
  }

  private migrateModelProviderSchema(): void {
    if (!this.database) {
      return;
    }

    const columns = new Set(
      (
        this.database
          .prepare('PRAGMA table_info(model_provider_configs)')
          .all() as Array<{ name: string }>
      ).map((column) => column.name),
    );
    const addColumnStatements = [
      ['language_model_name', "ALTER TABLE model_provider_configs ADD COLUMN language_model_name TEXT NOT NULL DEFAULT ''"],
      ['vision_model_name', "ALTER TABLE model_provider_configs ADD COLUMN vision_model_name TEXT NOT NULL DEFAULT ''"],
      ['language_test_status', "ALTER TABLE model_provider_configs ADD COLUMN language_test_status TEXT NOT NULL DEFAULT 'unknown'"],
      ['language_test_message', "ALTER TABLE model_provider_configs ADD COLUMN language_test_message TEXT NOT NULL DEFAULT ''"],
      ['language_tested_at', "ALTER TABLE model_provider_configs ADD COLUMN language_tested_at TEXT NOT NULL DEFAULT ''"],
      ['vision_test_status', "ALTER TABLE model_provider_configs ADD COLUMN vision_test_status TEXT NOT NULL DEFAULT 'unknown'"],
      ['vision_test_message', "ALTER TABLE model_provider_configs ADD COLUMN vision_test_message TEXT NOT NULL DEFAULT ''"],
      ['vision_tested_at', "ALTER TABLE model_provider_configs ADD COLUMN vision_tested_at TEXT NOT NULL DEFAULT ''"],
    ] as const;

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

  insert(record: InteractionRecordInput): void {
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
      .run(
        record.id,
        record.provider,
        record.userPrompt,
        record.assistantReply,
        record.status,
        record.sessionId,
        record.cwd,
        record.startedAt,
        record.endedAt,
      );
  }

  listRecent(limit: number): InteractionRecord[] {
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
      .all(limit) as unknown as InteractionRecord[];
  }

  getPetIdentity(): PetIdentity {
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
      .get() as Partial<PetIdentity> | undefined;

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

  savePetIdentity(identity: PetIdentity): PetIdentity {
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
      .run(
        nextIdentity.name,
        nextIdentity.owner,
        nextIdentity.age,
        nextIdentity.hobbies,
        nextIdentity.gender,
        nextIdentity.bio,
        nextIdentity.updatedAt,
      );

    return nextIdentity;
  }

  listModelProviderConfigs(): PublicModelProviderConfig[] {
    return supportedModelProviders.map((provider) => toPublicModelProviderConfig(this.getModelProviderConfig(provider)));
  }

  getModelProviderConfig(provider: ModelProviderId): ModelProviderConfig {
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
      .get(provider) as Partial<ModelProviderConfig> | undefined;

    if (!record) {
      return createEmptyModelProviderConfig(provider);
    }

    const lastTestStatus =
      record.lastTestStatus === 'success' || record.lastTestStatus === 'failed' || record.lastTestStatus === 'unknown'
        ? record.lastTestStatus
        : 'unknown';
    const languageTestStatus =
      record.languageTestStatus === 'success' || record.languageTestStatus === 'failed' || record.languageTestStatus === 'unknown'
        ? record.languageTestStatus
        : lastTestStatus;
    const visionTestStatus =
      record.visionTestStatus === 'success' || record.visionTestStatus === 'failed' || record.visionTestStatus === 'unknown'
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

  saveModelProviderConfig(input: ModelProviderConfigInput): PublicModelProviderConfig {
    const currentConfig = this.getModelProviderConfig(input.provider);
    const nextConfig: ModelProviderConfig = {
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
      .run(
        nextConfig.provider,
        nextConfig.apiKey,
        nextConfig.languageModelName,
        nextConfig.languageModelName,
        nextConfig.visionModelName,
        nextConfig.lastTestStatus,
        nextConfig.lastTestMessage,
        nextConfig.languageTestStatus,
        nextConfig.languageTestMessage,
        nextConfig.languageTestedAt,
        nextConfig.visionTestStatus,
        nextConfig.visionTestMessage,
        nextConfig.visionTestedAt,
        nextConfig.updatedAt,
        nextConfig.testedAt,
      );

    return toPublicModelProviderConfig(nextConfig);
  }

  createReminderTask(input: ReminderTaskInput): ReminderTask {
    const now = new Date().toISOString();
    const task: ReminderTask = {
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
      .run(
        task.id,
        task.title,
        task.originalText,
        task.remindAt,
        task.timezone,
        task.status,
        task.snoozeUntil,
        task.createdAt,
        task.updatedAt,
        task.firedAt,
      );

    return task;
  }

  getReminderTask(id: string): ReminderTask | null {
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
      .get(id) as ReminderTask | undefined;

    return record ?? null;
  }

  listDueReminderTasks(nowIso: string): ReminderTask[] {
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
      .all(nowIso) as unknown as ReminderTask[];
  }

  listActiveReminderTasks(): ReminderTask[] {
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
        WHERE status IN ('pending', 'fired')
        ORDER BY remind_at ASC
      `)
      .all() as unknown as ReminderTask[];
  }

  markReminderFired(id: string): void {
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

  completeReminderTask(id: string): ReminderTask | null {
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

  snoozeReminderTask(id: string, remindAt: string): ReminderTask | null {
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

  updateReminderTask(input: ReminderTaskUpdateInput): ReminderTask | null {
    if (!this.database) {
      return null;
    }

    const currentTask = this.getReminderTask(input.id);
    if (!currentTask) {
      return null;
    }

    const now = new Date().toISOString();
    this.database
      .prepare(`
        UPDATE reminder_tasks
        SET title = ?,
            original_text = ?,
            remind_at = ?,
            timezone = ?,
            status = 'pending',
            snooze_until = '',
            fired_at = '',
            updated_at = ?
        WHERE id = ?
      `)
      .run(
        input.title.trim(),
        typeof input.originalText === 'string' ? input.originalText.trim() : currentTask.originalText,
        input.remindAt,
        typeof input.timezone === 'string' ? input.timezone.trim() : currentTask.timezone,
        now,
        input.id,
      );

    return this.getReminderTask(input.id);
  }

  cancelReminderTask(id: string): ReminderTask | null {
    if (!this.database) {
      return null;
    }

    const now = new Date().toISOString();
    this.database
      .prepare(`
        UPDATE reminder_tasks
        SET status = 'cancelled',
            updated_at = ?
        WHERE id = ?
      `)
      .run(now, id);

    return this.getReminderTask(id);
  }

  getTranslationConfig(): TranslationConfig {
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
      .get() as Partial<TranslationConfig> | undefined;

    if (!record) {
      return defaultTranslationConfig;
    }

    const targetLanguage =
      record.targetLanguage === 'english' ||
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

  saveTranslationConfig(input: Partial<TranslationConfig>): TranslationConfig {
    const currentConfig = this.getTranslationConfig();
    const targetLanguage =
      input.targetLanguage === 'english' ||
      input.targetLanguage === 'chinese' ||
      input.targetLanguage === 'russian' ||
      input.targetLanguage === 'french' ||
      input.targetLanguage === 'japanese' ||
      input.targetLanguage === 'italian'
        ? input.targetLanguage
        : currentConfig.targetLanguage;
    const shortcut = typeof input.shortcut === 'string' && input.shortcut.trim() ? input.shortcut.trim().slice(0, 80) : currentConfig.shortcut;
    const nextConfig: TranslationConfig = {
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

  getGitActivityConfig(): GitActivityConfig {
    if (!this.database) {
      return defaultGitActivityConfig;
    }

    const record = this.database
      .prepare(`
        SELECT
          enabled,
          translate_commit AS translateCommit,
          summary_time AS summaryTime,
          updated_at AS updatedAt
        FROM git_activity_config
        WHERE id = 1
      `)
      .get() as { enabled?: number; translateCommit?: number; summaryTime?: string; updatedAt?: string } | undefined;

    if (!record) {
      return defaultGitActivityConfig;
    }

    return {
      enabled: record.enabled === 1,
      translateCommit: record.translateCommit === 1,
      summaryTime: typeof record.summaryTime === 'string' && record.summaryTime ? record.summaryTime : '20:00',
      updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : '',
    };
  }

  saveGitActivityConfig(input: Partial<GitActivityConfig>): GitActivityConfig {
    const currentConfig = this.getGitActivityConfig();
    const nextConfig: GitActivityConfig = {
      enabled: typeof input.enabled === 'boolean' ? input.enabled : currentConfig.enabled,
      translateCommit: typeof input.translateCommit === 'boolean' ? input.translateCommit : currentConfig.translateCommit,
      summaryTime: typeof input.summaryTime === 'string' && /^\d{2}:\d{2}$/.test(input.summaryTime) ? input.summaryTime : currentConfig.summaryTime,
      updatedAt: new Date().toISOString(),
    };

    if (!this.database) {
      return nextConfig;
    }

    this.database
      .prepare(`
        INSERT INTO git_activity_config (
          id,
          enabled,
          translate_commit,
          summary_time,
          updated_at
        )
        VALUES (1, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          enabled = excluded.enabled,
          translate_commit = excluded.translate_commit,
          summary_time = excluded.summary_time,
          updated_at = excluded.updated_at
      `)
      .run(
        nextConfig.enabled ? 1 : 0,
        nextConfig.translateCommit ? 1 : 0,
        nextConfig.summaryTime,
        nextConfig.updatedAt,
      );

    return nextConfig;
  }

  listRecentGitActivityEvents(limit: number): GitActivityEvent[] {
    if (!this.database) {
      return [];
    }

    return this.database
      .prepare(`
        SELECT
          id,
          event_type AS eventType,
          repo_path AS repoPath,
          branch,
          remote,
          commit_hash AS commitHash,
          commit_message AS commitMessage,
          translated_message AS translatedMessage,
          created_at AS createdAt,
          notified_at AS notifiedAt
        FROM git_activity_events
        ORDER BY created_at DESC
        LIMIT ?
      `)
      .all(limit) as unknown as GitActivityEvent[];
  }

  listUnnotifiedGitActivityEvents(limit: number): GitActivityEvent[] {
    if (!this.database) {
      return [];
    }

    return this.database
      .prepare(`
        SELECT
          id,
          event_type AS eventType,
          repo_path AS repoPath,
          branch,
          remote,
          commit_hash AS commitHash,
          commit_message AS commitMessage,
          translated_message AS translatedMessage,
          created_at AS createdAt,
          notified_at AS notifiedAt
        FROM git_activity_events
        WHERE notified_at = ''
        ORDER BY created_at ASC
        LIMIT ?
      `)
      .all(limit) as unknown as GitActivityEvent[];
  }

  markGitActivityEventsNotified(ids: string[]): void {
    if (!this.database || ids.length === 0) {
      return;
    }

    const now = new Date().toISOString();
    const statement = this.database.prepare(`
      UPDATE git_activity_events
      SET notified_at = ?
      WHERE id = ?
    `);
    for (const id of ids) {
      statement.run(now, id);
    }
  }

  getGitActivityStatsForDate(date: string): GitActivityStats {
    if (!this.database) {
      return { date, commitCount: 0, pushCount: 0, repoCount: 0 };
    }

    const start = `${date}T00:00:00.000`;
    const end = `${date}T23:59:59.999`;
    const record = this.database
      .prepare(`
        SELECT
          SUM(CASE WHEN event_type = 'commit' THEN 1 ELSE 0 END) AS commitCount,
          SUM(CASE WHEN event_type = 'push' THEN 1 ELSE 0 END) AS pushCount,
          COUNT(DISTINCT repo_path) AS repoCount
        FROM git_activity_events
        WHERE datetime(created_at) >= datetime(?)
          AND datetime(created_at) <= datetime(?)
      `)
      .get(start, end) as { commitCount?: number | null; pushCount?: number | null; repoCount?: number | null } | undefined;

    return {
      date,
      commitCount: record?.commitCount ?? 0,
      pushCount: record?.pushCount ?? 0,
      repoCount: record?.repoCount ?? 0,
    };
  }
}
