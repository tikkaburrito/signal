import { curator, briefSchema } from './agent';
import { fromExa } from './sources/exa';
import { fromYouTube } from './sources/youtube';
import type { Candidate } from './sources/types';
import { itemId, saveSent, seenIds, taste } from './db';
import { briefBlocks, postToSlack } from './slack';

// Add a lane = add one function here. Each source fails independently.
const SOURCES: Record<string, () => Promise<Candidate[]>> = {
  youtube: () => fromYouTube(),
  exa: () => fromExa(),
  // x: () => fromX(),            // next: logged-in browser session via Kernel
  // newsletters: () => fromAgentMail(),
};

export async function runBrief(focus?: string) {
  const names = Object.keys(SOURCES);
  const settled = await Promise.allSettled(names.map((n) => SOURCES[n]()));
  const failed = names.filter((_, i) => settled[i].status === 'rejected');
  settled.forEach((s, i) => s.status === 'rejected' && console.error(`source ${names[i]} failed`, s.reason));

  const seen = await seenIds();
  const byUrl = new Map<string, Candidate>();
  for (const s of settled) {
    if (s.status !== 'fulfilled') continue;
    for (const c of s.value) if (c.snippet && !seen.has(itemId(c.url))) byUrl.set(c.url, c);
  }
  const candidates = [...byUrl.values()].slice(0, 80);
  if (candidates.length < 3) {
    await postToSlack(`Signal: only ${candidates.length} new candidates, nothing worth sending.` +
      (failed.length ? ` Sources down: ${failed.join(', ')}.` : ''));
    return { sent: 0, candidates: candidates.length, failed };
  }

  const { liked, disliked } = await taste();
  const prompt = [
    focus ? `TODAY'S FOCUS (from the user, overrides the default mix): ${focus}` : '',
    `PAST REACTIONS\nLiked:\n${liked.join('\n') || '(none yet)'}\nDisliked:\n${disliked.join('\n') || '(none yet)'}`,
    `CANDIDATES\n${candidates
      .map((c, i) => `[${i}] lane=${c.lane} source=${c.source}\ntitle: ${c.title}\nsnippet: ${c.snippet}`)
      .join('\n\n')}`,
  ].filter(Boolean).join('\n\n');

  // Schema goes in the prompt: the gateway's native response format dropped the required "opener".
  const result = await curator.generate(prompt, {
    structuredOutput: { schema: briefSchema, jsonPromptInjection: true },
  });
  const brief = result.object;

  // The model returns indexes, never URLs, so a link can't be hallucinated.
  brief.items = brief.items.filter((it) => candidates[it.index]);
  const picked = brief.items.map((it) => candidates[it.index]);

  await postToSlack(`Signal: ${brief.opener}`, briefBlocks(brief, picked));
  await saveSent(
    picked.map((c, n) => ({ id: itemId(c.url), url: c.url, title: c.title, source: c.source, lane: c.lane, tag: brief.items[n].tag })),
  );
  return { sent: picked.length, candidates: candidates.length, failed };
}
