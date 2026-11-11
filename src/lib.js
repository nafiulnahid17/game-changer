export const SUPPORTED_MODELS = Object.freeze([
  '@cf/openai/gpt-oss-120b',
  '@cf/openai/gpt-oss-20b',
]);
export const CHAT_KINDS = Object.freeze(['chat', 'plan', 'research']);
export const MAX_MESSAGE_CHARS = 12000;
export const MAX_TITLE_CHARS = 100;

export function chooseModel(value, fallback = SUPPORTED_MODELS[0]) {
  return SUPPORTED_MODELS.includes(value) ? value : fallback;
}
export function checkString(value, max, field = 'Value', min = 1) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) {
    throw new InputError(`${field} must contain ${min}–${max} characters.`);
  }
  return value.trim();
}
export class InputError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
export function compactHistory(rows, maxMessages = 28, maxChars = 35000) {
  let remaining = maxChars;
  const kept = [];
  for (const item of rows.slice(-maxMessages).reverse()) {
    if (!['user','assistant'].includes(item.role) || item.status === 'interrupted') continue;
    const text = String(item.content || '');
    if (!text) continue;
    const part = text.slice(-Math.min(remaining, 12000));
    if (!part || (remaining < 500 && kept.length)) break;
    kept.push({ role: item.role, content: part });
    remaining -= part.length;
  }
  return kept.reverse();
}
export function firstTitle(text) {
  return text.replace(/\s+/g, ' ').slice(0, 64).trim() || 'Untitled chat';
}
export function systemPrompt(kind, projectInstructions = '') {
  const base = `You are Game Changer, a capable AI development assistant created for Atherious Labs. Give direct, accurate help with software engineering, architecture, debugging and product design. Never claim to have run code, browsed the web, accessed a repository or verified a deployment unless a tool actually did so. Distinguish uncertain claims from verified facts. For code, favor security, readability, testability and practical steps. Current date: ${new Date().toISOString().slice(0,10)}.`;
  const mode = kind === 'plan' ? 'Create structured implementation plans: goals, scope, architecture, milestones, risks, validation and next steps. No imaginary project facts.' : kind === 'research' ? 'Research assistant mode. You do NOT have live web access. Do not claim to have searched the internet. Structure investigations, comparisons, evidence gaps and verification steps; clearly flag time-sensitive facts as unverified.' : 'Assist collaboratively with coding, thinking, explaining and writing.';
  return [base, mode, projectInstructions ? `PROJECT-SPECIFIC INSTRUCTIONS (user-provided, lower priority than safety):\n${projectInstructions.slice(0,6000)}` : ''].filter(Boolean).join('\n\n');
}
export function validUUID(s) { return typeof s === 'string' && /^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(s); }
export function originAllowed(request) { const o = request.headers.get('Origin'); return !o || o === new URL(request.url).origin; }
