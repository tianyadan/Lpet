import { useEffect, useMemo, useRef, useState } from 'react';
import { ZoomableImage } from './ZoomableImage';
import { extractClipboardImageFile, readImageFileAsDataUrl } from '../utils/imageAttachment';

export interface QuickCommandTargetOption {
  id: string;
  label: string;
  logoUrl?: string;
  kind: 'cli' | 'provider';
}

interface QuickCommandInputProps {
  prompt: string;
  attachedImage: string | null;
  selectedTargetId: string;
  targetOptions: QuickCommandTargetOption[];
  skills: LocalSkill[];
  selectedSkill: LocalSkill | null;
  onSkillMenuOpenChange: (isOpen: boolean) => void;
  canAttachImage: boolean;
  intent: CodexRunIntent;
  isRunning: boolean;
  hasSession: boolean;
  onPromptChange: (prompt: string) => void;
  onAttachedImageChange: (image: string | null) => void;
  onTargetChange: (targetId: string) => void;
  onSkillSelect: (skill: LocalSkill | null) => void;
  onIntentChange: (intent: CodexRunIntent) => void;
  onSubmit: () => void;
  onClose: () => void;
}

/** 快捷输入框：支持文本、图片附件与 Ctrl/Cmd+Enter 发送。 */
export function QuickCommandInput({
  prompt,
  attachedImage,
  selectedTargetId,
  targetOptions,
  skills,
  selectedSkill,
  onSkillMenuOpenChange,
  canAttachImage,
  intent,
  isRunning,
  hasSession,
  onPromptChange,
  onAttachedImageChange,
  onTargetChange,
  onSkillSelect,
  onIntentChange,
  onSubmit,
  onClose,
}: QuickCommandInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isTargetMenuOpen, setIsTargetMenuOpen] = useState(false);
  const [isSkillMenuOpen, setIsSkillMenuOpen] = useState(false);
  const [skillQuery, setSkillQuery] = useState('');
  const canSubmit = Boolean(prompt.trim() || attachedImage);
  const selectedTarget = targetOptions.find((option) => option.id === selectedTargetId) ?? targetOptions[0];
  const skillOptions = useMemo(() => {
    const normalizedQuery = skillQuery.trim().toLowerCase();
    const enabledSkills = skills.filter((skill) => skill.enabled);
    if (normalizedQuery.length > 4) {
      return [];
    }

    const matchedSkills = normalizedQuery
      ? enabledSkills
          .filter((skill) =>
            `${skill.name} ${skill.description}`.toLowerCase().includes(normalizedQuery),
          )
          .sort((left, right) => {
            const leftStartsWith = left.name.toLowerCase().startsWith(normalizedQuery);
            const rightStartsWith = right.name.toLowerCase().startsWith(normalizedQuery);
            if (leftStartsWith === rightStartsWith) {
              return left.name.localeCompare(right.name, 'zh-Hans-CN');
            }
            return leftStartsWith ? -1 : 1;
          })
      : enabledSkills;

    return matchedSkills.slice(0, 8);
  }, [skillQuery, skills]);

  useEffect(() => {
    onSkillMenuOpenChange(isSkillMenuOpen);
  }, [isSkillMenuOpen, onSkillMenuOpenChange]);

  useEffect(() => {
    function preventBrowserHistoryBack(event: KeyboardEvent) {
      if (event.key !== 'Backspace' && event.key !== 'Delete') {
        return;
      }

      const target = event.target as HTMLElement | null;
      const isEditableTarget =
        target?.isContentEditable ||
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement;
      if (!isEditableTarget) {
        event.preventDefault();
      }
    }

    // WHY：Electron 仍保留浏览器 Backspace 后退行为，快捷窗口打开时空删可能把桌宠页面导航走。
    window.addEventListener('keydown', preventBrowserHistoryBack, true);
    return () => {
      window.removeEventListener('keydown', preventBrowserHistoryBack, true);
    };
  }, []);

  async function attachImageFile(file: File) {
    if (!canAttachImage) {
      window.alert('请先配置全模态模型。');
      return;
    }

    try {
      const dataUrl = await readImageFileAsDataUrl(file);
      onAttachedImageChange(dataUrl);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '图片添加失败。');
    }
  }

  async function handlePaste(event: React.ClipboardEvent<HTMLTextAreaElement>) {
    const imageFile = extractClipboardImageFile(event);
    if (!imageFile) {
      return;
    }

    event.preventDefault();
    if (!canAttachImage) {
      window.alert('请先配置全模态模型。');
      return;
    }
    await attachImageFile(imageFile);
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    await attachImageFile(file);
  }

  function handlePromptChange(nextPrompt: string) {
    onPromptChange(nextPrompt);

    if (intent !== 'task' || isRunning) {
      setIsSkillMenuOpen(false);
      return;
    }

    const slashMatch = nextPrompt.match(/(?:^|\s)\/([\p{L}\p{N}_-]*)$/u);
    if (!slashMatch) {
      setIsSkillMenuOpen(false);
      setSkillQuery('');
      return;
    }

    const nextSkillQuery = slashMatch[1] ?? '';
    if (nextSkillQuery.length > 4) {
      setIsSkillMenuOpen(false);
      setSkillQuery(nextSkillQuery);
      return;
    }

    setSkillQuery(nextSkillQuery);
    setIsSkillMenuOpen(true);
  }

  function selectSkill(skill: LocalSkill) {
    const nextPrompt = prompt.replace(/(^|\s)\/([\p{L}\p{N}_-]*)$/u, (_matched, prefix: string) =>
      prefix,
    );
    onPromptChange(nextPrompt.trimStart());
    onSkillSelect(skill);
    setIsSkillMenuOpen(false);
    setSkillQuery('');
  }

  return (
    <section className="quick-command" aria-label="快捷 AI 指令">
      <div className="quick-command-row">
        <div className="quick-command-target-picker">
          <button
            type="button"
            className="quick-command-provider"
            disabled={isRunning || targetOptions.length <= 1}
            aria-haspopup="listbox"
            aria-expanded={isTargetMenuOpen}
            onClick={() => setIsTargetMenuOpen((current) => !current)}
          >
            {selectedTarget?.logoUrl && <img src={selectedTarget.logoUrl} alt="" aria-hidden="true" />}
            <span>{selectedTarget?.label ?? '无可用目标'}</span>
            {selectedTarget && (
              <span className={selectedTarget.kind === 'cli' ? 'quick-command-kind quick-command-kind-cli' : 'quick-command-kind quick-command-kind-provider'}>
                {selectedTarget.kind === 'cli' ? 'CLI' : '供应商'}
              </span>
            )}
          </button>
          {isTargetMenuOpen && targetOptions.length > 1 && (
            <div className="quick-command-target-menu" role="listbox">
              {targetOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="option"
                  aria-selected={option.id === selectedTargetId}
                  onClick={() => {
                    onTargetChange(option.id);
                    setIsTargetMenuOpen(false);
                  }}
                >
                  {option.logoUrl && <img src={option.logoUrl} alt="" aria-hidden="true" />}
                  <span>{option.label}</span>
                  <span className={option.kind === 'cli' ? 'quick-command-kind quick-command-kind-cli' : 'quick-command-kind quick-command-kind-provider'}>
                    {option.kind === 'cli' ? 'CLI' : '供应商'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button type="button" className="quick-command-close" onClick={onClose} aria-label="关闭快捷输入">
          ×
        </button>
      </div>

      {attachedImage && (
        <div className="quick-command-image-row">
          <ZoomableImage src={attachedImage} alt="待发送图片" />
          <button
            type="button"
            className="quick-command-image-remove"
            aria-label="移除图片"
            disabled={isRunning}
            onClick={() => onAttachedImageChange(null)}
          >
            移除
          </button>
        </div>
      )}

      <div className="quick-command-input-wrap">
        {selectedSkill && intent === 'task' && (
          <div className="quick-command-selected-skill-row">
            <span className="quick-command-skill-chip">
              <span className="quick-command-skill-chip-label">Skill</span>
              <span className="quick-command-skill-chip-name">{selectedSkill.name}</span>
              <button
                type="button"
                aria-label="取消选择 Skill"
              disabled={isRunning}
              onClick={() => onSkillSelect(null)}
            >
                ×
              </button>
            </span>
          </div>
        )}
        <textarea
          className="quick-command-input"
          value={prompt}
          disabled={isRunning}
          autoFocus
          placeholder={hasSession ? '继续追问当前对话，可粘贴图片...' : '输入快捷任务，执行任务模式下输入 / 选择 Skills...'}
          onChange={(event) => handlePromptChange(event.target.value)}
          onPaste={handlePaste}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              if (isSkillMenuOpen) {
                setIsSkillMenuOpen(false);
                return;
              }
              onClose();
            }
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
              event.preventDefault();
              if (canSubmit && !isRunning) {
                onSubmit();
              }
            }
          }}
        />
        {intent === 'task' && isSkillMenuOpen && (
          <div className="quick-command-skill-menu" role="listbox">
            {skillOptions.length > 0 ? (
              skillOptions.map((skill) => (
                <button
                  key={skill.id}
                  type="button"
                  role="option"
                  aria-selected={skill.id === selectedSkill?.id}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectSkill(skill)}
                >
                  <span className="quick-command-skill-option-name">{skill.name}</span>
                  <span className="quick-command-skill-option-source">{skill.source}</span>
                </button>
              ))
            ) : (
              <div className="quick-command-skill-empty">未发现匹配的本地 Skills</div>
            )}
          </div>
        )}
      </div>

      <div className="quick-command-footer">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="quick-command-file-input"
          aria-hidden
          tabIndex={-1}
          onChange={handleFileChange}
        />
        <button
          type="button"
          className="quick-command-attach"
          disabled={isRunning || !canAttachImage}
          title={canAttachImage ? '上传图片' : '请先配置全模态模型'}
          onClick={() => fileInputRef.current?.click()}
        >
          图片
        </button>
        <div className="quick-command-intent" role="radiogroup" aria-label="选择交互类型">
          <button
            type="button"
            className={intent === 'chat' ? 'quick-command-intent-active' : ''}
            disabled={isRunning}
            onClick={() => {
              onSkillSelect(null);
              setIsSkillMenuOpen(false);
              onIntentChange('chat');
            }}
          >
            问答
          </button>
          <button
            type="button"
            className={intent === 'task' ? 'quick-command-intent-active' : ''}
            disabled={isRunning}
            onClick={() => onIntentChange('task')}
          >
            执行任务
          </button>
        </div>
        <button type="button" className="quick-command-submit" disabled={isRunning || !canSubmit} onClick={onSubmit}>
          发送
        </button>
      </div>
    </section>
  );
}
