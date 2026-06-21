export const DEFAULT_MODEL_CHOICE = "fast";

export const MODEL_CHOICES = [
  ["fast", "Fast"],
  ["smart", "Smart"],
  ["research", "Research"],
];

export function normalizeModelChoice(value) {
  return MODEL_CHOICES.some(([choice]) => choice === value) ? value : DEFAULT_MODEL_CHOICE;
}
