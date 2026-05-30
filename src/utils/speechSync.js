const MIN_REVEAL_MS = 2400;
const MAX_REVEAL_MS = 30000;
const MS_PER_WORD = 520;

export const estimateRevealMs = (content) => {
  const words = String(content || "").trim().split(/\s+/).filter(Boolean).length;
  const estimated = words * MS_PER_WORD;
  return Math.max(MIN_REVEAL_MS, Math.min(MAX_REVEAL_MS, estimated));
};

export const estimateTypingTickMs = (content) => {
  const chars = String(content || "").length;
  if (chars < 80) return 42;
  if (chars < 220) return 48;
  if (chars < 500) return 54;
  return 60;
};
