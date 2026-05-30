const MIN_REVEAL_MS = 2800;
const MAX_REVEAL_MS = 36000;
const MS_PER_WORD = 620;

export const estimateRevealMs = (content) => {
  const words = String(content || "").trim().split(/\s+/).filter(Boolean).length;
  const estimated = words * MS_PER_WORD;
  return Math.max(MIN_REVEAL_MS, Math.min(MAX_REVEAL_MS, estimated));
};

export const estimateTypingTickMs = (content) => {
  const chars = String(content || "").length;

  if (chars < 80) return 50;
  if (chars < 220) return 58;
  if (chars < 500) return 66;

  return 74;
};
