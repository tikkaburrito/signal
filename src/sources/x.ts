import Exa from 'exa-js';
import type { Candidate } from './types';

// Lane 1b: what AI CEOs and influencers are saying on X. Exa no longer indexes x.com directly,
// so this finds their posts through mirrors and same-week coverage that quotes them.
const QUERIES = [
  'what Sam Altman, Dario Amodei, Demis Hassabis or Mustafa Suleyman posted on X about AI this week',
  'what Satya Nadella, Sundar Pichai, Jensen Huang, Elon Musk or Mark Zuckerberg posted on X about AI this week',
  'what Andrej Karpathy, Ethan Mollick, Simon Willison, swyx or Andrew Ng said on X about AI agents this week',
];

export async function fromX(hoursBack = 72): Promise<Candidate[]> {
  const key = process.env.EXA_API_KEY;
  if (!key) return [];
  const exa = new Exa(key);
  const startPublishedDate = new Date(Date.now() - hoursBack * 3600_000).toISOString();

  const batches = await Promise.allSettled(
    QUERIES.map((q) =>
      exa.search(q, { type: 'auto', numResults: 6, startPublishedDate, contents: { highlights: true } }),
    ),
  );

  if (batches.every((b) => b.status === 'rejected')) throw (batches[0] as PromiseRejectedResult).reason;

  return batches.flatMap((b) =>
    b.status !== 'fulfilled'
      ? []
      : b.value.results.map((r): Candidate => ({
          url: r.url,
          title: r.title ?? r.url,
          source: `X voices: ${new URL(r.url).hostname.replace(/^www\./, '')}`,
          lane: 'my-world',
          publishedAt: r.publishedDate ?? undefined,
          snippet: (r.highlights ?? []).join(' … ').slice(0, 1200),
        })),
  );
}
