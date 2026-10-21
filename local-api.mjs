// Browser-only stand-in for the Cloudflare Worker API, used by the static
// (GitHub Pages) build. Runs and answers live in localStorage on this device.
import { TIERS, matchAnswer, etDate, resetAt, ROUND_MS, PREVIEW_MS } from './rules.mjs';
import { DEMO } from './demo.mjs';

const KEY = 'ok:static-runs';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
const save = runs => { try { localStorage.setItem(KEY, JSON.stringify(runs)); } catch { /* storage may be blocked */ } };
const uuid = () => crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
const fail = message => { throw new Error(message); };

function puzzleFor(date) {
  return { ...DEMO, date, dayNumber: Math.floor((Date.parse(date) - Date.parse('2026-07-16')) / 86400000) + 1, sample: true };
}
function promptDTO(p) {
  return { date: p.date, dayNumber: p.dayNumber, sample: true, source: p.source, resetsAt: resetAt(p.date), prompts: p.prompts.map(({ id, text }) => ({ id, text })) };
}
function state(run) {
  const results = run.answers.slice().sort((a, b) => a.round - b.round);
  return { ...promptDTO(puzzleFor(run.date)), runId: run.id, mode: run.mode, round: run.next_round, roundStart: run.round_start, pausedAt: run.paused_at || null, serverNow: Date.now(), completed: !!run.completed, results, score: results.reduce((s, r) => s + r.score, 0) };
}

export async function localApi(fullPath, data) {
  const [path, query = ''] = fullPath.split('?');
  const params = new URLSearchParams(query);
  const runs = load(), date = etDate();
  const own = id => runs[id] || null;

  if (data === undefined) {
    if (path === 'today') return promptDTO(puzzleFor(date));
    if (path === 'state') { const run = own(params.get('run')); return run ? state(run) : fail('Dive not found on this browser.'); }
    if (path === 'review') {
      const run = own(params.get('run'));
      if (!run?.completed) fail('Finish your dive before opening the answer sheet.');
      const p = puzzleFor(run.date);
      return { prompts: p.prompts.map(q => ({ ...q, answers: q.answers.map(a => ({ ...a, score: TIERS[a.tier].score })).sort((a, b) => b.score - a.score || a.answer.localeCompare(b.answer)) })), population: 0, betterThan: null, dist: Array(71).fill(0) };
    }
    fail('Unknown endpoint.');
  }

  if (path === 'start') {
    const mode = data.practice === true ? 'practice' : 'daily';
    let run = mode === 'daily' ? Object.values(runs).find(r => r.mode === 'daily' && r.date === date) : null;
    if (!run) {
      run = { id: uuid(), date, mode, next_round: 0, round_start: Date.now() + PREVIEW_MS, paused_at: null, completed: false, answers: [] };
      runs[run.id] = run; save(runs);
    }
    return state(run);
  }
  const run = own(data.runId);
  if (!run) fail('Dive not found.');

  if (path === 'pause') {
    if (data.paused === true && !run.completed && run.round_start !== null && !run.paused_at && Date.now() <= run.round_start + ROUND_MS) run.paused_at = Date.now();
    else if (data.paused === false && run.paused_at) { run.round_start += Date.now() - run.paused_at; run.paused_at = null; }
    save(runs); return state(run);
  }
  if (path === 'next') {
    if (run.paused_at) fail('Close the menu to resume your dive.');
    if (!run.completed && run.round_start === null) { run.round_start = Date.now() + PREVIEW_MS; save(runs); }
    return state(run);
  }
  if (path === 'answer') {
    if (run.paused_at) fail('Close the menu to resume your dive.');
    if (run.completed || run.round_start === null || data.round !== run.next_round) return { state: state(run), alreadyScored: true };
    const prompt = puzzleFor(run.date).prompts[run.next_round];
    const raw = typeof data.answer === 'string' ? data.answer.trim().slice(0, 256) : '';
    const late = Date.now() > run.round_start + ROUND_MS;
    const timely = !late || (data.timeout === true && Date.now() <= run.round_start + ROUND_MS + 1500);
    const match = raw && timely ? matchAnswer(raw, prompt.answers) : null;
    if (!match && raw && !late && !data.timeout) return { rejected: true, message: `“${raw}”: no echo. try again` };
    if (match?.correction && data.confirm !== true && !late && !data.timeout && data.previewCorrection !== false) return { correction: match.answer, original: raw };
    const result = { round: run.next_round, rawAnswer: raw || null, answer: match?.answer || null, tier: match?.tier || null, score: match ? TIERS[match.tier].score : 0 };
    run.answers.push(result);
    run.next_round += 1; run.round_start = null; run.completed = result.round === 6;
    save(runs);
    return { result: { ...result, quip: match?.quip || null, promptText: prompt.text }, state: state(run) };
  }
  if (path === 'feedback') return { ok: true };
  fail('Unknown endpoint.');
}
