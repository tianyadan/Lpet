import { app, BrowserWindow, clipboard, dialog, globalShortcut, ipcMain, Menu, nativeImage, screen, systemPreferences, Tray } from 'electron';
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { InteractionHistoryService, } from './services/InteractionHistoryService.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let petWindow = null;
let codexWindow = null;
const reminderWindows = new Map();
let tray = null;
let activeCodexProcess = null;
let reminderPollTimer = null;
let isQuickTranslating = false;
let activeRun = null;
const FALLBACK_CLI_SEARCH_PATHS = ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin'];
const hasSingleInstanceLock = app.requestSingleInstanceLock();
const historyService = new InteractionHistoryService();
const sessionIdPattern = /session id:\s*([0-9a-f-]{36})/i;
const translationLanguageLabels = {
    english: '英语',
    chinese: '中文',
    russian: '俄语',
    french: '法语',
    japanese: '日本语',
    italian: '意大利语',
};
const PET_SKIN_ROOT_NAME = 'pet-skins';
/** 与 src/pet/constants.ts 保持一致，主进程按桌宠锚点换算窗口位置。 */
const PET_CELL_WIDTH = 192;
const PET_CELL_HEIGHT = 208;
const PET_SHELL_BOTTOM_INSET = 24;
const PET_WINDOW_EDGE_PAD = 4;
function getCompactPetWindowSize(scale = 1) {
    return {
        width: Math.ceil(PET_CELL_WIDTH * scale + PET_WINDOW_EDGE_PAD),
        height: Math.ceil(PET_CELL_HEIGHT * scale + PET_SHELL_BOTTOM_INSET + PET_WINDOW_EDGE_PAD),
    };
}
function clampPetWindowPosition(window, anchorX, anchorY, scale) {
    const bounds = window.getBounds();
    const petVisualWidth = PET_CELL_WIDTH * scale;
    const petVisualHeight = PET_CELL_HEIGHT * scale;
    const display = screen.getDisplayMatching({
        x: Math.round(anchorX),
        y: Math.round(anchorY),
        width: 1,
        height: 1,
    });
    const workArea = display.workArea;
    const clampedAnchorX = Math.min(Math.max(anchorX, workArea.x + petVisualWidth), workArea.x + workArea.width);
    const clampedAnchorY = Math.min(Math.max(anchorY, workArea.y + petVisualHeight), workArea.y + workArea.height);
    return {
        x: Math.round(clampedAnchorX - bounds.width),
        y: Math.round(clampedAnchorY - bounds.height + PET_SHELL_BOTTOM_INSET),
    };
}
function loadRenderer(window, view, query = {}) {
    const devServerUrl = process.env.VITE_DEV_SERVER_URL ?? (!app.isPackaged ? 'http://127.0.0.1:5173' : null);
    if (devServerUrl) {
        const url = new URL(devServerUrl);
        url.searchParams.set('view', view);
        for (const [key, value] of Object.entries(query)) {
            url.searchParams.set(key, value);
        }
        void window.loadURL(url.toString());
        if (view !== 'reminder') {
            window.webContents.openDevTools({ mode: 'detach' });
        }
    }
    else {
        void window.loadFile(path.join(__dirname, '../dist/index.html'), {
            query: { view, ...query },
        });
    }
}
function createPetWindow() {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    const initialSize = getCompactPetWindowSize(1);
    const window = new BrowserWindow({
        width: initialSize.width,
        height: initialSize.height,
        x: width - initialSize.width - 24,
        y: height - initialSize.height - 24,
        frame: false,
        transparent: true,
        resizable: false,
        movable: false,
        alwaysOnTop: true,
        hasShadow: false,
        skipTaskbar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });
    window.setAlwaysOnTop(true, 'floating');
    window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    loadRenderer(window, 'pet');
    return window;
}
function createCodexWindow() {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    const window = new BrowserWindow({
        width: 420,
        height: 520,
        minWidth: 320,
        minHeight: 340,
        x: Math.max(40, width - 760),
        y: Math.max(40, height - 620),
        frame: false,
        transparent: true,
        resizable: true,
        movable: true,
        alwaysOnTop: true,
        hasShadow: true,
        skipTaskbar: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });
    window.setAlwaysOnTop(true, 'floating');
    window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    window.on('closed', () => {
        codexWindow = null;
    });
    loadRenderer(window, 'codex');
    return window;
}
function openCodexWindow() {
    if (!codexWindow || codexWindow.isDestroyed()) {
        codexWindow = createCodexWindow();
        return;
    }
    codexWindow.show();
    codexWindow.focus();
}
function createReminderWindow(task) {
    const window = new BrowserWindow({
        width: 380,
        height: 268,
        minWidth: 340,
        minHeight: 240,
        frame: false,
        transparent: true,
        resizable: false,
        movable: true,
        alwaysOnTop: true,
        hasShadow: true,
        skipTaskbar: false,
        center: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });
    window.setAlwaysOnTop(true, 'modal-panel');
    window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    window.on('closed', () => {
        reminderWindows.delete(task.id);
    });
    loadRenderer(window, 'reminder', { reminderId: task.id });
    reminderWindows.set(task.id, window);
    return window;
}
function openReminderWindow(task) {
    const existingWindow = reminderWindows.get(task.id);
    if (existingWindow && !existingWindow.isDestroyed()) {
        existingWindow.show();
        existingWindow.focus();
        return;
    }
    const window = createReminderWindow(task);
    window.show();
    window.focus();
}
function isExecutableFile(filePath) {
    try {
        fs.accessSync(filePath, fs.constants.X_OK);
        return true;
    }
    catch {
        return false;
    }
}
function findNvmCliCandidates(commandName) {
    const nvmVersionsRoot = path.join(os.homedir(), '.nvm/versions/node');
    if (!fs.existsSync(nvmVersionsRoot)) {
        return [];
    }
    try {
        return fs
            .readdirSync(nvmVersionsRoot)
            .map((versionName) => path.join(nvmVersionsRoot, versionName, 'bin', commandName))
            .filter(isExecutableFile);
    }
    catch {
        return [];
    }
}
function resolveCliFromShell(commandName) {
    const shellCommands = [
        ['/bin/zsh', ['-lic', `command -v ${commandName}`]],
        ['/bin/zsh', ['-lc', `command -v ${commandName}`]],
    ];
    for (const [shellPath, shellArgs] of shellCommands) {
        const result = spawnSync(shellPath, shellArgs, {
            env: process.env,
            encoding: 'utf8',
            timeout: 3000,
        });
        const resolvedPath = result.stdout.trim().split('\n').at(-1)?.trim();
        if (resolvedPath && isExecutableFile(resolvedPath)) {
            return resolvedPath;
        }
    }
    return null;
}
function resolveCliPath({ commandName, envName, appCandidatePaths = [], }) {
    const configuredCliPath = process.env[envName]?.trim();
    if (configuredCliPath && isExecutableFile(configuredCliPath)) {
        return { installed: true, path: configuredCliPath, source: 'env' };
    }
    const pathEntries = Array.from(new Set((process.env.PATH ?? '')
        .split(path.delimiter)
        .map((entry) => entry.trim())
        .filter(Boolean)
        .concat(FALLBACK_CLI_SEARCH_PATHS)));
    for (const pathEntry of pathEntries) {
        const cliPath = path.join(pathEntry, commandName);
        if (isExecutableFile(cliPath)) {
            return { installed: true, path: cliPath, source: 'path' };
        }
    }
    const nvmCliPath = findNvmCliCandidates(commandName)[0];
    if (nvmCliPath) {
        return { installed: true, path: nvmCliPath, source: 'nvm' };
    }
    for (const candidatePath of appCandidatePaths) {
        if (isExecutableFile(candidatePath)) {
            return { installed: true, path: candidatePath, source: 'app' };
        }
    }
    const shellCliPath = resolveCliFromShell(commandName);
    if (shellCliPath) {
        return { installed: true, path: shellCliPath, source: 'shell' };
    }
    return { installed: false, path: null, source: null };
}
function resolveCodexCliPath() {
    return resolveCliPath({
        commandName: 'codex',
        envName: 'CODEX_CLI_PATH',
    });
}
function checkCodexInstallations() {
    const cli = resolveCodexCliPath();
    const cursor = resolveCliPath({
        commandName: 'cursor',
        envName: 'CURSOR_CLI_PATH',
        appCandidatePaths: ['/Applications/Cursor.app/Contents/Resources/app/bin/cursor'],
    });
    const claudeCode = resolveCliPath({
        commandName: 'claude',
        envName: 'CLAUDE_CLI_PATH',
    });
    return {
        cli,
        cursor,
        claudeCode,
        diagnostics: {
            pid: process.pid,
            homeDir: os.homedir(),
            configuredCliPath: process.env.CODEX_CLI_PATH?.trim() || null,
            configuredCursorPath: process.env.CURSOR_CLI_PATH?.trim() || null,
            configuredClaudePath: process.env.CLAUDE_CLI_PATH?.trim() || null,
        },
    };
}
function sendCodexEvent(payload) {
    petWindow?.webContents.send('codex:event', payload);
    codexWindow?.webContents.send('codex:event', payload);
}
function extractSessionId(output) {
    return output.match(sessionIdPattern)?.[1] ?? null;
}
function extractAssistantText(output) {
    const placeholderAnswerPatterns = [/这里写/, /最终结果/, /给用户的回答/, /真实回答/];
    function extractPetResponse(text) {
        const matches = Array.from(text.matchAll(/<CodexPetResponse>([\s\S]*?)<\/CodexPetResponse>/gi));
        const latestResponse = matches.at(-1)?.[1]?.trim();
        if (!latestResponse) {
            return '';
        }
        try {
            const parsed = JSON.parse(latestResponse);
            if (typeof parsed.answer !== 'string') {
                return '';
            }
            const answer = parsed.answer.trim();
            return placeholderAnswerPatterns.some((pattern) => pattern.test(answer)) ? '' : answer;
        }
        catch {
            return '';
        }
    }
    function stripProtocol(text) {
        return text
            .replace(/<CodexPetResponse>[\s\S]*?<\/CodexPetResponse>/gi, '')
            .replace(/<CodexPetPlan>[\s\S]*?<\/CodexPetPlan>/gi, '')
            .replace(/<CodexPetProgress\s+step="\d+"\s+status="(?:done|failed|running)"\s*\/>/gi, '')
            .replace(/<ScheduledReminder>[\s\S]*?<\/ScheduledReminder>/gi, '')
            .replace(/<CodexPetHistory>[\s\S]*?<\/CodexPetHistory>/gi, '')
            .replace(/<CodexPetIdentity>[\s\S]*?<\/CodexPetIdentity>/gi, '')
            .replace(/^OpenAI Codex v[\s\S]*?--------\n/m, '')
            .replace(/^workdir:[\s\S]*?--------\n/m, '')
            .replace(/^user\n[\s\S]*?\ncodex\n/m, '')
            .replace(/\ntokens used[\s\S]*$/i, '')
            .trim();
    }
    const petResponseAnswer = extractPetResponse(output);
    if (petResponseAnswer) {
        return petResponseAnswer;
    }
    const codexStartIndex = output.lastIndexOf('\ncodex\n');
    if (codexStartIndex < 0) {
        return stripProtocol(output);
    }
    const contentStartIndex = codexStartIndex + '\ncodex\n'.length;
    const contentEndIndex = output.indexOf('\ntokens used', contentStartIndex);
    return stripProtocol(output.slice(contentStartIndex, contentEndIndex > -1 ? contentEndIndex : undefined));
}
function normalizeScheduledReminderPayload(input, fallbackOriginalText) {
    if (!input || typeof input !== 'object') {
        return null;
    }
    const record = input;
    if (record.type !== 'scheduled_reminder') {
        return null;
    }
    const title = typeof record.title === 'string' ? record.title.trim() : '';
    const originalText = typeof record.originalText === 'string' && record.originalText.trim()
        ? record.originalText.trim()
        : fallbackOriginalText.trim();
    const remindAt = typeof record.remindAt === 'string' ? record.remindAt.trim() : '';
    const reminderDate = new Date(remindAt);
    if (!title || !originalText || !remindAt || Number.isNaN(reminderDate.getTime())) {
        return null;
    }
    return {
        type: 'scheduled_reminder',
        title,
        originalText,
        remindAt: reminderDate.toISOString(),
        timezone: typeof record.timezone === 'string' ? record.timezone.trim() : Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
}
function extractScheduledReminderPayload(output, fallbackOriginalText) {
    const taggedMatches = Array.from(output.matchAll(/<ScheduledReminder>([\s\S]*?)<\/ScheduledReminder>/gi));
    for (const match of taggedMatches.reverse()) {
        try {
            const parsed = JSON.parse(match[1].trim());
            const normalized = normalizeScheduledReminderPayload(parsed, fallbackOriginalText);
            if (normalized) {
                return normalized;
            }
        }
        catch {
            // Ignore malformed candidate and continue scanning other outputs.
        }
    }
    const jsonMatches = Array.from(output.matchAll(/\{[\s\S]*?"type"\s*:\s*"scheduled_reminder"[\s\S]*?\}/g));
    for (const match of jsonMatches.reverse()) {
        try {
            const parsed = JSON.parse(match[0]);
            const normalized = normalizeScheduledReminderPayload(parsed, fallbackOriginalText);
            if (normalized) {
                return normalized;
            }
        }
        catch {
            // Ignore malformed candidate and continue scanning other outputs.
        }
    }
    return null;
}
function createReminderFromCodexOutput(output, fallbackOriginalText) {
    const payload = extractScheduledReminderPayload(output, fallbackOriginalText);
    if (!payload) {
        return null;
    }
    return historyService.createReminderTask({
        title: payload.title,
        originalText: payload.originalText,
        remindAt: payload.remindAt,
        timezone: payload.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
}
function checkDueReminders() {
    const dueTasks = historyService.listDueReminderTasks(new Date().toISOString());
    for (const task of dueTasks) {
        historyService.markReminderFired(task.id);
        const firedTask = historyService.getReminderTask(task.id) ?? task;
        openReminderWindow(firedTask);
    }
    if (dueTasks.length > 0) {
        sendCodexEvent({ type: 'reminders-updated' });
    }
}
function startReminderScheduler() {
    if (reminderPollTimer) {
        return;
    }
    checkDueReminders();
    reminderPollTimer = setInterval(checkDueReminders, 30_000);
}
function shouldAttachHistoryContext(prompt) {
    return /刚才|之前|历史|记录|做了什么|交互|问过/.test(prompt);
}
function buildHistoryContext(prompt) {
    if (!shouldAttachHistoryContext(prompt)) {
        return '';
    }
    const recentRecords = historyService.listRecent(8);
    if (recentRecords.length === 0) {
        return '';
    }
    return [
        '以下是桌宠本地记录的最近交互，用户询问历史时优先基于这些记录回答：',
        ...recentRecords.map((record, index) => {
            const reply = record.assistantReply.slice(0, 600);
            return `${index + 1}. ${record.startedAt} 用户：${record.userPrompt}\n   AI：${reply}`;
        }),
    ].join('\n');
}
function normalizeTextField(value, maxLength) {
    if (typeof value !== 'string') {
        return '';
    }
    return value.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}
function normalizeBioField(value) {
    if (typeof value !== 'string') {
        return '';
    }
    return value
        .replace(/<[^>]*>/g, '')
        .replace(/\r\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
        .slice(0, 500);
}
function normalizePetIdentity(input) {
    const record = typeof input === 'object' && input !== null ? input : {};
    const gender = record.gender === 'male' || record.gender === 'female' || record.gender === 'other' ? record.gender : 'other';
    return {
        name: normalizeTextField(record.name, 40),
        owner: normalizeTextField(record.owner, 40),
        age: normalizeTextField(record.age, 20),
        hobbies: normalizeTextField(record.hobbies, 160),
        gender,
        bio: normalizeBioField(record.bio),
        updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : '',
    };
}
const modelProviderEndpoints = {
    qwen: {
        baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
        defaultModel: 'qwen-plus',
        defaultVisionModel: 'qwen-vl-plus',
    },
    deepseek: {
        baseUrl: 'https://api.deepseek.com/chat/completions',
        defaultModel: 'deepseek-chat',
    },
};
const visionEnabledModelProviders = ['qwen'];
function normalizeModelProviderId(value) {
    if (value === 'qwen' || value === 'deepseek') {
        return value;
    }
    throw new Error('Unsupported model provider');
}
function normalizeModelProviderInput(input) {
    const record = typeof input === 'object' && input !== null ? input : {};
    const provider = normalizeModelProviderId(record.provider);
    const rawLanguageModelName = typeof record.languageModelName === 'string'
        ? record.languageModelName
        : typeof record.modelName === 'string'
            ? record.modelName
            : modelProviderEndpoints[provider].defaultModel;
    const rawVisionModelName = typeof record.visionModelName === 'string' ? record.visionModelName : '';
    return {
        provider,
        apiKey: typeof record.apiKey === 'string' && record.apiKey.trim()
            ? record.apiKey.trim().slice(0, 4096)
            : undefined,
        languageModelName: rawLanguageModelName.trim().slice(0, 120),
        visionModelName: rawVisionModelName.trim().slice(0, 120),
    };
}
async function callOpenAiCompatibleModel({ provider, apiKey, modelName, messages, maxTokens, extraBody = {}, timeoutMs, }) {
    const endpoint = modelProviderEndpoints[provider];
    const abortController = timeoutMs ? new AbortController() : null;
    const timeout = timeoutMs
        ? setTimeout(() => {
            abortController?.abort();
        }, timeoutMs)
        : null;
    let response;
    try {
        response = await fetch(endpoint.baseUrl, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: modelName,
                messages,
                max_tokens: maxTokens,
                temperature: 0.2,
                ...extraBody,
            }),
            signal: abortController?.signal,
        });
    }
    finally {
        if (timeout) {
            clearTimeout(timeout);
        }
    }
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    const payload = (await response.json());
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
        throw new Error('Empty model response');
    }
    return content.trim();
}
async function testModelProviderConnection(input) {
    const configInput = normalizeModelProviderInput(input);
    const savedConfig = historyService.getModelProviderConfig(configInput.provider);
    const apiKey = configInput.apiKey?.trim() || savedConfig.apiKey;
    const languageModelName = configInput.languageModelName.trim() || savedConfig.languageModelName || modelProviderEndpoints[configInput.provider].defaultModel;
    const visionModelName = configInput.visionModelName?.trim() || savedConfig.visionModelName || '';
    if (!apiKey || !languageModelName) {
        throw new Error('请先填写 API Key 和语言模型。');
    }
    const supportsVision = visionEnabledModelProviders.includes(configInput.provider);
    const testedAt = new Date().toISOString();
    try {
        await callOpenAiCompatibleModel({
            provider: configInput.provider,
            apiKey,
            modelName: languageModelName,
            messages: [{ role: 'user', content: 'ping' }],
            maxTokens: 8,
        });
        let nextVisionStatus = savedConfig.visionTestStatus;
        let nextVisionMessage = savedConfig.visionTestMessage;
        let nextVisionTestedAt = savedConfig.visionTestedAt;
        if (supportsVision && visionModelName) {
            try {
                await callOpenAiCompatibleModel({
                    provider: configInput.provider,
                    apiKey,
                    modelName: visionModelName,
                    messages: [
                        {
                            role: 'user',
                            content: [
                                { type: 'text', text: '请用一句话描述这张测试图片。' },
                                {
                                    type: 'image_url',
                                    image_url: {
                                        url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAFeAJcgrM6NwAAAABJRU5ErkJggg==',
                                    },
                                },
                            ],
                        },
                    ],
                    maxTokens: 24,
                });
                nextVisionStatus = 'success';
                nextVisionMessage = '多模态模型连接测试通过';
            }
            catch {
                nextVisionStatus = 'failed';
                nextVisionMessage = '多模态模型测试失败，图片上传问答将被禁用。';
            }
            nextVisionTestedAt = testedAt;
        }
        // WHY：测试成功后立即保存当前输入，首页状态灯才能和实际可用配置保持一致。
        return historyService.saveModelProviderConfig({
            provider: configInput.provider,
            apiKey,
            languageModelName,
            visionModelName,
            lastTestStatus: 'success',
            lastTestMessage: '连接测试通过',
            languageTestStatus: 'success',
            visionTestStatus: supportsVision ? nextVisionStatus : 'unknown',
            visionTestMessage: supportsVision ? nextVisionMessage : '',
            visionTestedAt: supportsVision ? nextVisionTestedAt : '',
            testedAt,
        });
    }
    catch {
        historyService.saveModelProviderConfig({
            provider: configInput.provider,
            apiKey,
            languageModelName,
            visionModelName,
            lastTestStatus: 'failed',
            lastTestMessage: '测试失败，请检查 API Key 或模型名称。',
            languageTestStatus: 'failed',
            visionTestStatus: supportsVision ? 'failed' : 'unknown',
            visionTestMessage: supportsVision ? '测试失败，请检查 API Key 或多模态模型名称。' : '',
            visionTestedAt: supportsVision ? testedAt : '',
            testedAt,
        });
        throw new Error('测试失败，请检查 API Key 或模型名称。');
    }
}
function normalizeImageDataUrl(value) {
    if (typeof value !== 'string') {
        return null;
    }
    return /^data:image\/(?:png|jpeg|jpg|webp);base64,/i.test(value) ? value : null;
}
function getReadyVisionConfig() {
    for (const provider of visionEnabledModelProviders) {
        const config = historyService.getModelProviderConfig(provider);
        if (config.apiKey && config.visionModelName && config.visionTestStatus === 'success') {
            return config;
        }
    }
    return null;
}
async function analyzeImageForPrompt(imageDataUrl, userPrompt) {
    const visionConfig = getReadyVisionConfig();
    if (!visionConfig) {
        throw new Error('未配置可用的多模态模型，请先在设置中配置通义千问多模态模型并测试通过。');
    }
    return callOpenAiCompatibleModel({
        provider: visionConfig.provider,
        apiKey: visionConfig.apiKey,
        modelName: visionConfig.visionModelName,
        maxTokens: 520,
        messages: [
            {
                role: 'system',
                content: '你是图片解析助手。请把图片中与用户问题相关的信息转成中文文本，最多 400 字。只输出图片事实和可见内容，不要回答用户最终问题。',
            },
            {
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: userPrompt ? `用户问题：${userPrompt}` : '请解析图片中的关键信息。',
                    },
                    {
                        type: 'image_url',
                        image_url: { url: imageDataUrl },
                    },
                ],
            },
        ],
    });
}
async function chatWithModelProvider(input) {
    const record = typeof input === 'object' && input !== null ? input : {};
    const provider = normalizeModelProviderId(record.provider);
    const prompt = typeof record.prompt === 'string' ? record.prompt.trim() : '';
    const imageDataUrl = normalizeImageDataUrl(record.imageDataUrl);
    const config = historyService.getModelProviderConfig(provider);
    if (!config.apiKey || !config.languageModelName || config.languageTestStatus !== 'success') {
        throw new Error('当前模型供应商未测试通过，请先在设置中完成检测。');
    }
    const imageContext = imageDataUrl ? await analyzeImageForPrompt(imageDataUrl, prompt) : '';
    const identityContext = buildPetIdentityContext();
    const answer = await callOpenAiCompatibleModel({
        provider,
        apiKey: config.apiKey,
        modelName: config.languageModelName,
        maxTokens: 1200,
        messages: [
            {
                role: 'system',
                content: [
                    '你是桌面宠物的问答模型。请直接回答用户问题，语言自然简洁。',
                    identityContext,
                    imageContext ? `图片解析结果：\n${imageContext}` : '',
                ]
                    .filter(Boolean)
                    .join('\n\n'),
            },
            {
                role: 'user',
                content: prompt || '请根据图片解析结果回答。',
            },
        ],
    });
    return { answer };
}
function delay(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}
function waitForProcess(command, args, timeoutMs = 2500) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args);
        let stderr = '';
        let settled = false;
        const timeout = setTimeout(() => {
            if (settled) {
                return;
            }
            settled = true;
            child.kill('SIGTERM');
            resolve({ code: null, stderr: stderr || 'copy command timed out' });
        }, timeoutMs);
        child.stderr.on('data', (chunk) => {
            stderr += chunk.toString('utf8');
        });
        child.on('error', (error) => {
            if (settled) {
                return;
            }
            settled = true;
            clearTimeout(timeout);
            reject(error);
        });
        child.on('close', (code) => {
            if (settled) {
                return;
            }
            settled = true;
            clearTimeout(timeout);
            resolve({ code, stderr });
        });
    });
}
async function copySelectedTextToClipboard() {
    const previousText = clipboard.readText();
    clipboard.writeText('');
    if (process.platform === 'darwin') {
        if (!systemPreferences.isTrustedAccessibilityClient(false)) {
            systemPreferences.isTrustedAccessibilityClient(true);
            throw new Error('快捷翻译需要 macOS 辅助功能权限。请在 系统设置 > 隐私与安全性 > 辅助功能 中允许当前终端或 Electron，然后重启桌宠。');
        }
        const result = await waitForProcess('/usr/bin/osascript', [
            '-e',
            'tell application "System Events" to keystroke "c" using command down',
        ]);
        if (result.code !== 0) {
            throw new Error(`复制选中文字失败：${result.stderr.trim() || 'osascript 执行失败'}`);
        }
    }
    else if (process.platform === 'win32') {
        const result = await waitForProcess('powershell.exe', [
            '-NoProfile',
            '-Command',
            'Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait("^c")',
        ]);
        if (result.code !== 0) {
            throw new Error(`复制选中文字失败：${result.stderr.trim() || 'PowerShell 执行失败'}`);
        }
    }
    else {
        const result = await waitForProcess('sh', ['-lc', 'xdotool key ctrl+c']);
        if (result.code !== 0) {
            throw new Error(`复制选中文字失败：${result.stderr.trim() || 'xdotool 执行失败'}`);
        }
    }
    let selectedText = '';
    for (let index = 0; index < 16; index += 1) {
        await delay(80);
        selectedText = clipboard.readText().trim();
        if (selectedText) {
            break;
        }
    }
    if (previousText && selectedText !== previousText) {
        clipboard.writeText(previousText);
    }
    else if (!selectedText && previousText) {
        clipboard.writeText(previousText);
    }
    return selectedText;
}
function getPreferredTranslationProvider() {
    const configs = historyService.listModelProviderConfigs();
    const availableConfig = configs.find((config) => config.languageTestStatus === 'success' && config.hasApiKey && config.languageModelName);
    return availableConfig?.provider ?? null;
}
function buildFastTranslationExtraBody(provider) {
    if (provider === 'qwen') {
        return {
            stream: false,
            enable_thinking: false,
        };
    }
    if (provider === 'deepseek') {
        return {
            stream: false,
            thinking: { type: 'disabled' },
        };
    }
    return { stream: false };
}
async function translateWithModelProvider(text, targetLanguage) {
    const provider = getPreferredTranslationProvider();
    if (!provider) {
        throw new Error('No available model provider');
    }
    const config = historyService.getModelProviderConfig(provider);
    if (!config.apiKey || !config.languageModelName) {
        throw new Error('Model provider is not configured');
    }
    return callOpenAiCompatibleModel({
        provider,
        apiKey: config.apiKey,
        modelName: config.languageModelName,
        messages: [
            {
                role: 'system',
                content: 'You are a low-latency translation engine. Translate the user text into the requested target language. Return only the translated text. Do not reason, do not explain, do not add alternatives.',
            },
            {
                role: 'user',
                content: `Target language: ${targetLanguage}\n\nText:\n${text}`,
            },
        ],
        maxTokens: 700,
        extraBody: buildFastTranslationExtraBody(provider),
        timeoutMs: 12_000,
    });
}
async function translateWithCodexCli(text, targetLanguage) {
    const resolvedCli = resolveCodexCliPath();
    if (!resolvedCli.path) {
        throw new Error('未检测到可用模型供应商，也未检测到 Codex CLI。');
    }
    const prompt = [
        'Translate the following text.',
        `Target language: ${targetLanguage}`,
        'Return only the translated text. Do not explain.',
        '',
        text,
    ].join('\n');
    const child = spawn(resolvedCli.path, ['exec', '--color', 'never', '--skip-git-repo-check', '-C', process.cwd(), '-'], {
        cwd: process.cwd(),
        env: {
            ...process.env,
            NO_COLOR: '1',
        },
    });
    let output = '';
    let errorOutput = '';
    const timeout = setTimeout(() => {
        child.kill('SIGTERM');
    }, 12_000);
    child.stdin.end(prompt);
    child.stdout.on('data', (chunk) => {
        output += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk) => {
        errorOutput += chunk.toString('utf8');
    });
    const exitCode = await new Promise((resolve, reject) => {
        child.on('error', reject);
        child.on('close', (code) => resolve(code));
    });
    clearTimeout(timeout);
    if (exitCode !== 0) {
        throw new Error(errorOutput || `Codex CLI exited with code ${exitCode}`);
    }
    return extractAssistantText(output) || output.trim();
}
async function runQuickTranslation() {
    if (isQuickTranslating) {
        return;
    }
    isQuickTranslating = true;
    const config = historyService.getTranslationConfig();
    const targetLanguage = translationLanguageLabels[config.targetLanguage] ?? '英语';
    sendCodexEvent({ type: 'translation-start', targetLanguage });
    try {
        const selectedText = await copySelectedTextToClipboard();
        if (!selectedText) {
            sendCodexEvent({ type: 'translation-error', message: '没有读取到选中的文字，请先选中文本后再按翻译快捷键。' });
            return;
        }
        let translatedText = '';
        let provider = 'model-provider';
        try {
            translatedText = await translateWithModelProvider(selectedText, targetLanguage);
        }
        catch {
            provider = 'codex-cli';
            translatedText = await translateWithCodexCli(selectedText, targetLanguage);
        }
        sendCodexEvent({
            type: 'translation-result',
            text: translatedText,
            sourceText: selectedText,
            targetLanguage,
            provider,
        });
    }
    catch (error) {
        sendCodexEvent({ type: 'translation-error', message: error instanceof Error ? error.message : String(error) });
    }
    finally {
        isQuickTranslating = false;
    }
}
function registerTranslationShortcut() {
    globalShortcut.unregisterAll();
    const config = historyService.getTranslationConfig();
    const registered = globalShortcut.register(config.shortcut, () => {
        void runQuickTranslation();
    });
    if (!registered) {
        sendCodexEvent({ type: 'translation-error', message: `翻译快捷键注册失败：${config.shortcut}，可能与系统或其他应用冲突。` });
    }
}
function buildPetIdentityContext() {
    const identity = historyService.getPetIdentity();
    const genderTextMap = {
        male: '男',
        female: '女',
        other: '其他',
    };
    const lines = [
        identity.name ? `名字：${identity.name}` : '',
        identity.owner ? `主人：${identity.owner}` : '',
        identity.age ? `年龄：${identity.age}` : '',
        `性别：${genderTextMap[identity.gender]}`,
        identity.hobbies ? `爱好：${identity.hobbies}` : '',
        identity.bio ? `简介：${identity.bio}` : '',
    ].filter(Boolean);
    if (lines.length === 0) {
        return '';
    }
    return [
        '以下是桌宠的身份设定。回答用户时可以自然沿用这个身份，不要生硬复述；除非用户要求，不要主动暴露完整身份字段：',
        ...lines,
    ].join('\n');
}
function readPromptTemplate(templateName) {
    const templateFileName = `${templateName}.txt`;
    const candidates = [
        path.join(process.cwd(), 'electron/prompts', templateFileName),
        path.join(__dirname, 'prompts', templateFileName),
    ];
    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            return fs.readFileSync(candidate, 'utf8');
        }
    }
    throw new Error(`Prompt template not found: ${templateFileName}`);
}
function buildCodexPetPrompt(prompt, intent) {
    const historyContext = buildHistoryContext(prompt);
    const identityContext = buildPetIdentityContext();
    const template = readPromptTemplate(intent);
    // WHY：提示词放在文本文件里，后续调协议不需要改主进程代码；运行时只注入必要变量，避免模板散落在业务逻辑里。
    return template
        .replace('{{historyContext}}', historyContext ? `<CodexPetHistory>\n${historyContext}\n</CodexPetHistory>` : '')
        .replace('{{identityContext}}', identityContext ? `<CodexPetIdentity>\n${identityContext}\n</CodexPetIdentity>` : '')
        .replace('{{userPrompt}}', prompt)
        .trim();
}
function finishActiveRun(status) {
    if (!activeRun) {
        return;
    }
    const nextSessionId = extractSessionId(activeRun.rawOutput) ?? activeRun.sessionId;
    historyService.insert({
        id: activeRun.id,
        provider: 'codex-cli',
        userPrompt: activeRun.prompt,
        assistantReply: extractAssistantText(activeRun.rawOutput),
        status,
        sessionId: nextSessionId,
        cwd: activeRun.cwd,
        startedAt: activeRun.startedAt,
        endedAt: new Date().toISOString(),
    });
    activeRun = null;
}
function normalizeCodexRunIntent(intent) {
    return intent === 'chat' || intent === 'task' ? intent : 'task';
}
function parseSkillMetadata(entryPath) {
    const fallbackName = path.basename(path.dirname(entryPath));
    try {
        const content = fs.readFileSync(entryPath, 'utf8');
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
        const frontmatter = frontmatterMatch?.[1] ?? '';
        const name = frontmatter.match(/^name:\s*["']?(.+?)["']?\s*$/m)?.[1]?.trim() ?? fallbackName;
        const description = frontmatter.match(/^description:\s*["']?([\s\S]*?)["']?\s*$/m)?.[1]?.trim() ??
            content
                .split('\n')
                .find((line) => line.trim() && !line.startsWith('---') && !line.startsWith('#'))
                ?.trim() ??
            '';
        return {
            name,
            description: description.replace(/\s+/g, ' ').slice(0, 280),
        };
    }
    catch {
        return {
            name: fallbackName,
            description: '',
        };
    }
}
function listSkillEntryFiles(rootDir, maxDepth = 4) {
    if (!fs.existsSync(rootDir)) {
        return [];
    }
    const result = [];
    const visit = (currentDir, depth) => {
        if (depth > maxDepth) {
            return;
        }
        let entries;
        try {
            entries = fs.readdirSync(currentDir, { withFileTypes: true });
        }
        catch {
            return;
        }
        for (const entry of entries) {
            const entryPath = path.join(currentDir, entry.name);
            if (entry.isFile() && entry.name === 'SKILL.md') {
                result.push(entryPath);
                continue;
            }
            if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git') {
                visit(entryPath, depth + 1);
            }
        }
    };
    visit(rootDir, 0);
    return result;
}
function listLocalSkills() {
    const homeDir = os.homedir();
    const searchRoots = [
        { dir: path.join(homeDir, '.codex', 'skills'), source: 'codex' },
        { dir: path.join(homeDir, '.agents', 'skills'), source: 'agents' },
        { dir: path.join(process.cwd(), 'skills'), source: 'project' },
    ];
    const seenPaths = new Set();
    return searchRoots
        .flatMap(({ dir, source }) => listSkillEntryFiles(dir).map((entryPath) => ({
        entryPath,
        source,
    })))
        .filter(({ entryPath }) => {
        const normalizedPath = path.resolve(entryPath);
        if (seenPaths.has(normalizedPath)) {
            return false;
        }
        seenPaths.add(normalizedPath);
        return true;
    })
        .map(({ entryPath, source }) => {
        const metadata = parseSkillMetadata(entryPath);
        return {
            id: `${source}:${path.relative(source === 'project' ? process.cwd() : homeDir, entryPath)}`,
            name: metadata.name,
            description: metadata.description,
            entryPath,
            enabled: true,
            source,
        };
    })
        .sort((left, right) => left.name.localeCompare(right.name, 'zh-Hans-CN'));
}
function getImportedSkinRoot() {
    return path.join(app.getPath('userData'), PET_SKIN_ROOT_NAME);
}
function sanitizeSkinDirectoryName(value) {
    const normalized = value.trim().replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
    return normalized || `skin-${Date.now()}`;
}
function getImageMimeType(filePath) {
    const extension = path.extname(filePath).toLowerCase();
    if (extension === '.png') {
        return 'image/png';
    }
    if (extension === '.jpg' || extension === '.jpeg') {
        return 'image/jpeg';
    }
    if (extension === '.gif') {
        return 'image/gif';
    }
    return 'image/webp';
}
function readImageDataUrl(filePath) {
    const mimeType = getImageMimeType(filePath);
    const imageData = fs.readFileSync(filePath).toString('base64');
    return `data:${mimeType};base64,${imageData}`;
}
function normalizeImportedSkinDirectory(directoryPath) {
    const petJsonPath = path.join(directoryPath, 'pet.json');
    if (!fs.existsSync(petJsonPath)) {
        return null;
    }
    try {
        const rawDefinition = JSON.parse(fs.readFileSync(petJsonPath, 'utf8'));
        const rawId = typeof rawDefinition.id === 'string' && rawDefinition.id.trim()
            ? rawDefinition.id.trim()
            : path.basename(directoryPath);
        const spritesheetPath = typeof rawDefinition.spritesheetPath === 'string' && rawDefinition.spritesheetPath.trim()
            ? rawDefinition.spritesheetPath.trim()
            : 'spritesheet.webp';
        const spritesheetFilePath = path.join(directoryPath, spritesheetPath);
        if (!fs.existsSync(spritesheetFilePath)) {
            return null;
        }
        return {
            id: `imported:${sanitizeSkinDirectoryName(rawId)}`,
            displayName: typeof rawDefinition.displayName === 'string' && rawDefinition.displayName.trim()
                ? rawDefinition.displayName.trim()
                : rawId,
            description: typeof rawDefinition.description === 'string' && rawDefinition.description.trim()
                ? rawDefinition.description.trim()
                : 'Imported Codex-compatible pet skin.',
            // WHY：开发模式渲染页是 http://127.0.0.1，直接加载 file:// 皮肤图会被浏览器安全策略拦截。
            spritesheetUrl: readImageDataUrl(spritesheetFilePath),
            source: 'imported',
            directoryPath,
        };
    }
    catch {
        return null;
    }
}
function listImportedPetSkins() {
    const skinRoot = getImportedSkinRoot();
    if (!fs.existsSync(skinRoot)) {
        return [];
    }
    return fs
        .readdirSync(skinRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => normalizeImportedSkinDirectory(path.join(skinRoot, entry.name)))
        .filter((skin) => Boolean(skin))
        .sort((left, right) => left.displayName.localeCompare(right.displayName, 'zh-Hans-CN'));
}
async function importPetSkinFromFolder() {
    const result = await dialog.showOpenDialog({
        title: '选择 Codex 适配皮肤文件夹',
        properties: ['openDirectory'],
        message: '请选择包含 pet.json 和 spritesheet.webp 的皮肤父文件夹。',
    });
    if (result.canceled || !result.filePaths[0]) {
        return null;
    }
    const sourceDirectory = result.filePaths[0];
    const sourceSkin = normalizeImportedSkinDirectory(sourceDirectory);
    if (!sourceSkin) {
        throw new Error('导入失败：请选择包含 pet.json 和 spritesheet.webp 的 Codex 适配皮肤文件夹。');
    }
    const skinRoot = getImportedSkinRoot();
    fs.mkdirSync(skinRoot, { recursive: true });
    const destinationDirectory = path.join(skinRoot, sanitizeSkinDirectoryName(sourceSkin.id.replace(/^imported:/, '')));
    if (path.resolve(sourceDirectory) !== path.resolve(destinationDirectory)) {
        fs.rmSync(destinationDirectory, { recursive: true, force: true });
        fs.cpSync(sourceDirectory, destinationDirectory, { recursive: true });
    }
    const importedSkin = normalizeImportedSkinDirectory(destinationDirectory);
    if (!importedSkin) {
        throw new Error('导入失败：复制后的皮肤文件不完整。');
    }
    return importedSkin;
}
function runCodexPrompt(prompt, target, sessionId, intent = 'task', elevated = false) {
    if (activeCodexProcess) {
        throw new Error('Codex task is already running');
    }
    const normalizedPrompt = prompt.trim();
    if (!normalizedPrompt) {
        throw new Error('Prompt is empty');
    }
    if (target !== 'codex-cli') {
        throw new Error('Unsupported Codex target');
    }
    const resolvedCli = resolveCodexCliPath();
    if (!resolvedCli.path) {
        throw new Error('未检测到 Codex CLI。请先安装 CLI，或通过 CODEX_CLI_PATH 指定可执行文件路径。');
    }
    const codexPath = resolvedCli.path;
    const workspaceRoot = process.cwd();
    const wrappedPrompt = buildCodexPetPrompt(normalizedPrompt, intent);
    const elevatedArgs = elevated ? ['--dangerously-bypass-approvals-and-sandbox'] : [];
    const args = sessionId
        ? ['exec', 'resume', ...elevatedArgs, '--skip-git-repo-check', sessionId, '-']
        : ['exec', '--color', 'never', ...elevatedArgs, '--skip-git-repo-check', '-C', workspaceRoot, '-'];
    // WHY：prompt 通过 stdin 传入，避免长文本、换行或特殊字符被命令行参数解析破坏。
    // Codex CLI 在检测到 stdin pipe 时会等待输入，因此必须在 spawn 后立即 end，否则会一直停在 Reading additional input。
    sendCodexEvent({
        type: 'start',
        command: `${codexPath} ${sessionId ? 'exec resume' : 'exec'}`,
        cwd: workspaceRoot,
        sessionId: sessionId ?? null,
        intent,
        elevated,
    });
    activeRun = {
        id: randomUUID(),
        prompt: normalizedPrompt,
        intent,
        rawOutput: '',
        cwd: workspaceRoot,
        startedAt: new Date().toISOString(),
        sessionId: sessionId ?? null,
        statusOverride: null,
    };
    const child = spawn(codexPath, args, {
        cwd: workspaceRoot,
        env: {
            ...process.env,
            NO_COLOR: '1',
        },
    });
    activeCodexProcess = child;
    child.stdin.end(wrappedPrompt);
    child.stdout.on('data', (chunk) => {
        const text = chunk.toString('utf8');
        if (activeRun) {
            activeRun.rawOutput += text;
        }
        sendCodexEvent({ type: 'stdout', text });
    });
    child.stderr.on('data', (chunk) => {
        const text = chunk.toString('utf8');
        if (activeRun) {
            activeRun.rawOutput += text;
        }
        sendCodexEvent({ type: 'stderr', text });
    });
    child.on('error', (error) => {
        if (activeCodexProcess === child) {
            activeCodexProcess = null;
        }
        finishActiveRun('failed');
        sendCodexEvent({ type: 'error', message: error.message });
    });
    child.on('close', (code, signal) => {
        if (activeCodexProcess === child) {
            activeCodexProcess = null;
        }
        if (code === 0 && activeRun?.intent === 'task') {
            const reminderTask = createReminderFromCodexOutput(activeRun.rawOutput, activeRun.prompt);
            if (reminderTask) {
                sendCodexEvent({
                    type: 'reminder-created',
                    id: reminderTask.id,
                    title: reminderTask.title,
                    remindAt: reminderTask.remindAt,
                });
            }
        }
        finishActiveRun(activeRun?.statusOverride ?? (code === 0 ? 'success' : 'failed'));
        sendCodexEvent({ type: 'exit', code, signal });
    });
}
function createTray() {
    const icon = nativeImage.createEmpty();
    tray = new Tray(icon);
    tray.setToolTip('Codex Pet Clone');
    tray.setContextMenu(Menu.buildFromTemplate([
        {
            label: '显示宠物',
            click: () => {
                petWindow?.show();
            },
        },
        {
            label: '退出',
            click: () => {
                app.quit();
            },
        },
    ]));
}
function registerIpc() {
    ipcMain.handle('pet:hide', () => {
        petWindow?.hide();
    });
    ipcMain.handle('pet:quit', () => {
        app.quit();
    });
    ipcMain.handle('codex-panel:open', () => {
        openCodexWindow();
    });
    ipcMain.handle('codex-panel:close', (event) => {
        const window = BrowserWindow.fromWebContents(event.sender);
        window?.close();
    });
    ipcMain.handle('window:resize-current', (event, width, height) => {
        const window = BrowserWindow.fromWebContents(event.sender);
        if (!window || typeof width !== 'number' || typeof height !== 'number') {
            return;
        }
        window.setSize(Math.max(320, Math.round(width)), Math.max(340, Math.round(height)));
    });
    ipcMain.handle('window:get-bounds', (event) => {
        const window = BrowserWindow.fromWebContents(event.sender);
        if (!window) {
            return null;
        }
        const bounds = window.getBounds();
        return {
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height,
        };
    });
    ipcMain.handle('window:set-position', (event, x, y) => {
        const window = BrowserWindow.fromWebContents(event.sender);
        if (!window || typeof x !== 'number' || typeof y !== 'number') {
            return;
        }
        window.setPosition(Math.round(x), Math.round(y));
    });
    ipcMain.handle('window:set-pet-anchor-position', (event, anchorX, anchorY, scale) => {
        const window = BrowserWindow.fromWebContents(event.sender);
        if (!window || typeof anchorX !== 'number' || typeof anchorY !== 'number') {
            return;
        }
        const normalizedScale = typeof scale === 'number' && Number.isFinite(scale) ? scale : 1;
        const nextPosition = clampPetWindowPosition(window, anchorX, anchorY, normalizedScale);
        window.setPosition(nextPosition.x, nextPosition.y);
    });
    ipcMain.handle('pet:set-mouse-passthrough', (event, ignore) => {
        const window = BrowserWindow.fromWebContents(event.sender);
        if (!window || typeof ignore !== 'boolean') {
            return;
        }
        if (ignore) {
            window.setIgnoreMouseEvents(true, { forward: true });
            return;
        }
        window.setIgnoreMouseEvents(false);
    });
    ipcMain.handle('window:set-size-keep-bottom-right', (event, width, height) => {
        const window = BrowserWindow.fromWebContents(event.sender);
        if (!window || typeof width !== 'number' || typeof height !== 'number') {
            return;
        }
        const bounds = window.getBounds();
        const nextWidth = Math.max(64, Math.round(width));
        const nextHeight = Math.max(64, Math.round(height));
        window.setBounds({
            x: bounds.x + bounds.width - nextWidth,
            y: bounds.y + bounds.height - nextHeight,
            width: nextWidth,
            height: nextHeight,
        });
    });
    ipcMain.handle('codex:check-installations', () => checkCodexInstallations());
    ipcMain.handle('skills:list', () => listLocalSkills());
    ipcMain.handle('pet-skins:list-imported', () => listImportedPetSkins());
    ipcMain.handle('pet-skins:import-folder', () => importPetSkinFromFolder());
    ipcMain.handle('pet-identity:get', () => historyService.getPetIdentity());
    ipcMain.handle('pet-identity:save', (_event, input) => {
        return historyService.savePetIdentity(normalizePetIdentity(input));
    });
    ipcMain.handle('model-providers:list', () => historyService.listModelProviderConfigs());
    ipcMain.handle('model-providers:save', (_event, input) => {
        return historyService.saveModelProviderConfig(normalizeModelProviderInput(input));
    });
    ipcMain.handle('model-providers:test', (_event, input) => testModelProviderConnection(input));
    ipcMain.handle('model-providers:chat', (_event, input) => chatWithModelProvider(input));
    ipcMain.handle('model-providers:analyze-image', (_event, input) => {
        const record = typeof input === 'object' && input !== null ? input : {};
        const imageDataUrl = normalizeImageDataUrl(record.imageDataUrl);
        const prompt = typeof record.prompt === 'string' ? record.prompt : '';
        if (!imageDataUrl) {
            throw new Error('图片数据无效。');
        }
        return analyzeImageForPrompt(imageDataUrl, prompt);
    });
    ipcMain.handle('reminders:get', (_event, id) => {
        if (typeof id !== 'string' || !id.trim()) {
            return null;
        }
        return historyService.getReminderTask(id.trim());
    });
    ipcMain.handle('reminders:list-active', () => historyService.listActiveReminderTasks());
    ipcMain.handle('reminders:update', (_event, input) => {
        const record = typeof input === 'object' && input !== null ? input : {};
        const id = typeof record.id === 'string' ? record.id.trim() : '';
        const title = typeof record.title === 'string' ? record.title.trim() : '';
        const remindAt = typeof record.remindAt === 'string' ? record.remindAt.trim() : '';
        const remindDate = new Date(remindAt);
        if (!id || !title || !remindAt || Number.isNaN(remindDate.getTime())) {
            throw new Error('提醒标题或时间无效。');
        }
        const task = historyService.updateReminderTask({
            id,
            title,
            remindAt: remindDate.toISOString(),
            originalText: typeof record.originalText === 'string' ? record.originalText : undefined,
            timezone: typeof record.timezone === 'string' ? record.timezone : Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
        sendCodexEvent({ type: 'reminders-updated' });
        checkDueReminders();
        return task;
    });
    ipcMain.handle('reminders:cancel', (_event, id) => {
        if (typeof id !== 'string' || !id.trim()) {
            return null;
        }
        const task = historyService.cancelReminderTask(id.trim());
        sendCodexEvent({ type: 'reminders-updated' });
        return task;
    });
    ipcMain.handle('reminders:complete', (event, id) => {
        if (typeof id !== 'string' || !id.trim()) {
            return null;
        }
        const task = historyService.completeReminderTask(id.trim());
        sendCodexEvent({ type: 'reminders-updated' });
        BrowserWindow.fromWebContents(event.sender)?.close();
        return task;
    });
    ipcMain.handle('reminders:snooze', (event, id, hours, minutes) => {
        if (typeof id !== 'string' || !id.trim()) {
            return null;
        }
        const normalizedHours = typeof hours === 'number' && Number.isFinite(hours) ? Math.max(0, Math.floor(hours)) : 0;
        const normalizedMinutes = typeof minutes === 'number' && Number.isFinite(minutes) ? Math.max(0, Math.floor(minutes)) : 0;
        const delayMinutes = Math.max(1, normalizedHours * 60 + normalizedMinutes);
        const nextRemindAt = new Date(Date.now() + delayMinutes * 60_000).toISOString();
        const task = historyService.snoozeReminderTask(id.trim(), nextRemindAt);
        sendCodexEvent({ type: 'reminders-updated' });
        BrowserWindow.fromWebContents(event.sender)?.close();
        return task;
    });
    ipcMain.handle('reminders:close', (event, id) => {
        if (typeof id === 'string' && id.trim()) {
            historyService.completeReminderTask(id.trim());
            sendCodexEvent({ type: 'reminders-updated' });
        }
        BrowserWindow.fromWebContents(event.sender)?.close();
    });
    ipcMain.handle('translation:get-config', () => historyService.getTranslationConfig());
    ipcMain.handle('translation:save-config', (_event, input) => {
        const record = typeof input === 'object' && input !== null ? input : {};
        const savedConfig = historyService.saveTranslationConfig({
            targetLanguage: record.targetLanguage === 'english' ||
                record.targetLanguage === 'chinese' ||
                record.targetLanguage === 'russian' ||
                record.targetLanguage === 'french' ||
                record.targetLanguage === 'japanese' ||
                record.targetLanguage === 'italian'
                ? record.targetLanguage
                : undefined,
            shortcut: typeof record.shortcut === 'string' ? record.shortcut : undefined,
        });
        registerTranslationShortcut();
        return savedConfig;
    });
    ipcMain.handle('codex:run', (_event, prompt, target, sessionId, intent, elevated) => {
        if (typeof prompt !== 'string') {
            throw new Error('Prompt must be a string');
        }
        const normalizedTarget = typeof target === 'string' ? target : 'codex-cli';
        const normalizedSessionId = typeof sessionId === 'string' && sessionId.trim() ? sessionId.trim() : null;
        runCodexPrompt(prompt, normalizedTarget, normalizedSessionId, normalizeCodexRunIntent(intent), elevated === true);
    });
    ipcMain.handle('codex:cancel', () => {
        if (!activeCodexProcess) {
            return;
        }
        if (activeRun) {
            activeRun.statusOverride = 'cancelled';
        }
        activeCodexProcess.kill('SIGTERM');
        sendCodexEvent({ type: 'cancelled' });
    });
}
if (!hasSingleInstanceLock) {
    app.quit();
}
else {
    app.on('second-instance', () => {
        // WHY：开发模式下多次 npm run dev 很容易留下旧 Electron 窗口；单实例能避免用户点到旧主进程。
        if (petWindow) {
            petWindow.show();
            petWindow.focus();
        }
        codexWindow?.show();
    });
    app.whenReady().then(() => {
        historyService.init();
        registerIpc();
        petWindow = createPetWindow();
        createTray();
        startReminderScheduler();
        registerTranslationShortcut();
        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                petWindow = createPetWindow();
            }
            checkDueReminders();
        });
    });
}
app.on('window-all-closed', () => {
    // WHY：桌宠以托盘作为常驻入口，窗口关闭后不主动退出，避免用户误关后找不到恢复入口。
});
app.on('will-quit', () => {
    globalShortcut.unregisterAll();
});
