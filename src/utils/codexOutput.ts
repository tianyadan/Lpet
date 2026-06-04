export interface TaskStep {
  id: string;
  label: string;
  status: 'idle' | 'pending' | 'running' | 'done' | 'failed';
}

export interface CodexPetResponse {
  mode: 'chat' | 'task';
  answer: string;
}

const sessionIdPattern = /session id:\s*([0-9a-f-]{36})/i;
const planPattern = /<CodexPetPlan>([\s\S]*?)<\/CodexPetPlan>/i;
const progressPattern = /<CodexPetProgress\s+step="(\d+)"\s+status="(done|failed|running)"\s*\/>/gi;
const responsePattern = /<CodexPetResponse>([\s\S]*?)<\/CodexPetResponse>/gi;
const placeholderAnswerPatterns = [/这里写/, /最终结果/, /给用户的回答/, /真实回答/];

export function extractSessionId(output: string): string | null {
  return output.match(sessionIdPattern)?.[1] ?? null;
}

export function removeProtocolTags(text: string): string {
  return text
    .replace(responsePattern, '')
    .replace(planPattern, '')
    .replace(progressPattern, '')
    .replace(/<CodexPetHistory>[\s\S]*?<\/CodexPetHistory>/gi, '')
    .replace(/你正在被一个桌面宠物应用调用。[\s\S]*?用户原始请求：/g, '')
    .replace(/^OpenAI Codex v[\s\S]*?--------\n/m, '')
    .replace(/^workdir:[\s\S]*?--------\n/m, '')
    .replace(/^user\n[\s\S]*?\ncodex\n/m, '')
    .replace(/\ntokens used[\s\S]*$/i, '')
    .trim();
}

export function extractPetResponse(output: string): CodexPetResponse | null {
  const matches = Array.from(output.matchAll(responsePattern));
  const latestResponse = matches.at(-1)?.[1]?.trim();
  if (!latestResponse) {
    return null;
  }

  try {
    const parsed = JSON.parse(latestResponse) as Partial<CodexPetResponse>;
    if ((parsed.mode === 'chat' || parsed.mode === 'task') && typeof parsed.answer === 'string') {
      const answer = parsed.answer.trim();
      if (placeholderAnswerPatterns.some((pattern) => pattern.test(answer))) {
        return null;
      }
      return {
        mode: parsed.mode,
        answer,
      };
    }
  } catch {
    return null;
  }

  return null;
}

export function extractAssistantText(output: string): string {
  const petResponse = extractPetResponse(output);
  if (petResponse?.answer) {
    return petResponse.answer;
  }

  const codexStartIndex = output.lastIndexOf('\ncodex\n');
  if (codexStartIndex < 0) {
    return '';
  }

  const contentStartIndex = codexStartIndex + '\ncodex\n'.length;
  const contentEndIndex = output.indexOf('\ntokens used', contentStartIndex);
  return removeProtocolTags(output.slice(contentStartIndex, contentEndIndex > -1 ? contentEndIndex : undefined));
}

export function extractPlanSteps(output: string): TaskStep[] {
  const planContent = output.match(planPattern)?.[1];
  if (!planContent) {
    return [];
  }

  return planContent
    .split('\n')
    .map((line) => line.replace(/^-\s+\[[ x]\]\s*/i, '').trim())
    .filter(Boolean)
    .slice(0, 6)
    .map((label, index) => ({
      id: `step-${index + 1}`,
      label,
      status: index === 0 ? 'running' : 'pending',
    }));
}

export function applyProgressEvents(currentSteps: TaskStep[], output: string): TaskStep[] {
  if (currentSteps.length === 0) {
    return currentSteps;
  }

  const nextSteps = currentSteps.map((step) => ({ ...step }));
  for (const match of output.matchAll(progressPattern)) {
    const stepIndex = Number(match[1]) - 1;
    const status = match[2] as TaskStep['status'];
    if (nextSteps[stepIndex]) {
      nextSteps[stepIndex].status = status;
      if (status === 'done' && nextSteps[stepIndex + 1]?.status === 'pending') {
        nextSteps[stepIndex + 1].status = 'running';
      }
    }
  }

  return nextSteps;
}

export function createIdleSteps(): TaskStep[] {
  return [];
}
