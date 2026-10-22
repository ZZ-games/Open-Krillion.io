// Helper for writing prompts. Tiers: plankton 10 · tooclever 15 · schooler 30 · rare 60 · deepcut 85 · krillion 100
// Answers are separated by ";" and extra accepted spellings follow a "/" (so answers can't contain "/" or ";").
import { normalize } from './rules.mjs';
const ORDER = ['plankton', 'tooclever', 'schooler', 'rare', 'deepcut', 'krillion'];
export function P(id, text, tiers) {
  const answers = [], seen = new Set();
  for (const tier of ORDER) {
    if (!tiers[tier]) continue;
    for (const item of tiers[tier].split(';')) {
      const [answer, ...aliases] = item.split('/').map(s => s.trim()).filter(Boolean);
      if (!answer) continue;
      const keys = [answer, ...aliases].map(normalize);
      if (keys.some(k => seen.has(k))) continue; // skip repeats within a prompt
      keys.forEach(k => seen.add(k));
      answers.push({ answer, tier, aliases });
    }
  }
  return { id, text, answers };
}

