import Exa from 'exa-js';
import type { Candidate } from './types';

// Lane 2: things I don't follow but should have seen.
const QUERIES: { q: string; category?: 'news' }[] = [
  { q: 'most important AI agent launch or research result this week', category: 'news' },
  { q: 'viral podcast episode this week with a founder or AI researcher, key takeaways' },
  { q: 'good news this week: scientific breakthrough, health, climate or human progress', category: 'news' },
  { q: 'inspiring story of a solo founder or small team reaching first customers' },
];

export async function fromExa(hoursBack = 72): Promise<Candidate[]> {
  const key = process.env.EXA_API_KEY;
  if (!key) return [];
  const exa = new Exa(key);
  const startPublishedDate = new Date(Date.now() - hoursBack * 3600_000).toISOString();

  const batches = await Promise.allSettled(
    QUERIES.map(({ q, category }) =>
      exa.search(q, {
        type: 'auto',
        numResults: 8,
        startPublishedDate,
        ...(category ? { category } : {}),
        contents: { highlights: true },
      }),
    ),
  );

  // Every query failing means the lane is down (bad key, quota): throw so the brief reports it.
  if (batches.every((b) => b.status === 'rejected')) throw (batches[0] as PromiseRejectedResult).reason;

  return batches.flatMap((b) =>
    b.status !== 'fulfilled'
      ? []
      : b.value.results.map((r): Candidate => ({
          url: r.url,
          title: r.title ?? r.url,
          source: `Exa: ${new URL(r.url).hostname.replace(/^www\./, '')}`,
          lane: 'outside-my-bubble',
          publishedAt: r.publishedDate ?? undefined,
          snippet: (r.highlights ?? []).join(' … ').slice(0, 1200),
        })),
  );
}
