export const DEFAULT_MODEL_CHOICE = "fast";

export const PUBLIC_MODEL_CHOICES = [
  ["fast", "Fast"],
  ["smart", "Smart"],
  ["research", "Research"],
];

export const ADMIN_MODEL_CHOICES = [
  ["fast", "google/gemini-2.5-flash"],
  ["smart", "nex-agi/nex-n2-pro:free"],
  ["research", "nvidia/nemotron-3-ultra-550b-a55b:free"],
  ["qwen3_235b_free", "qwen/qwen3-235b-a22b:free"],
  ["qwen3_30b_free", "qwen/qwen3-30b-a3b:free"],
  ["kimi_k2_free", "moonshotai/kimi-k2:free"],
  ["glm_45_air_free", "z-ai/glm-4.5-air:free"],
  ["mistral_small_free", "mistralai/mistral-small-3.2-24b-instruct:free"],
  ["llama4_scout_free", "meta-llama/llama-4-scout:free"],
  ["openrouter_free", "openrouter/free"],
];

export const MODEL_CHOICES = PUBLIC_MODEL_CHOICES;

const ALL_MODEL_CHOICES = [...ADMIN_MODEL_CHOICES, ...PUBLIC_MODEL_CHOICES];

export function normalizeModelChoice(value) {
  return ALL_MODEL_CHOICES.some(([choice]) => choice === value) ? value : DEFAULT_MODEL_CHOICE;
}

export function modelChoiceLabel(value) {
  const normalized = normalizeModelChoice(value);
  return ALL_MODEL_CHOICES.find(([choice]) => choice === normalized)?.[1] || normalized;
}
