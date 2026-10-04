import type { Candidate } from './types';

// Lane 1c: podcasts, YC and conference talks from a fixed list of YouTube channels.
// Uses each channel's public RSS feed, so it needs no API key or OAuth. Edit the list freely.
const CHANNELS: Record<string, string> = {
  'Y Combinator': 'UCcefcZRL2oaA_uBNeo5UOWg',
  "Lenny's Podcast": 'UC6t1O76G0jYXOAoYCm153dA',
  'Dwarkesh Patel': 'UCXl4i9dYBrFOabk0xGmbkRA',
  'Lex Fridman': 'UCSHZKyawb77ixDdsGog4iWA',
  'Latent Space': 'UCxBcwypKK-W3GHd_RZ9FZrQ',
  'No Priors': 'UCSI7h9hydQ40K5MJHnCrQvw',
  'Machine Learning Street Talk': 'UCMLtBahI5DMrt0NPvDSoIRQ',
  '20VC': 'UCf0PBRjhf0rF8fWBIxTuoWA',
  'My First Million': 'UCyaN6mg5u8Cjy2ZI4ikWaug',
  'All-In Podcast': 'UCESLZhusAkFfsNsApnjF_Cg',
  'Greg Isenberg': 'UCPjNBjflYl0-HQtUvOx0Ibw',
  a16z: 'UC9cn0TuPq4dnbTY-CBsm8XA',
  'Sequoia Capital': 'UCWrF0oN6unbXrWsTN7RctTw',
  'AI Engineer': 'UCLKPca3kwwd-B59HNr-_lvA',
  'Stanford Online': 'UCBa5G_ESCn8Yd4vw5U-gIcg',
  'Stanford GSB': 'UCGwuxdEeCf0TIA2RbPOj-8g',
  TED: 'UCAuUUnT6oDeKwE6v1NGQxug',
  Anthropic: 'UCrDwWp7EBBv4NwvScIpBDOA',
  OpenAI: 'UCXZCJLdBC09xxGZ6gcdrc6A',
  'Google DeepMind': 'UCP7jMXSY2xbc3KCAE0MHQ-A',
};

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };
const decode = (s: string) => s.replace(/&(amp|lt|gt|quot|#39);/g, (m) => ENTITIES[m]);
const tag = (xml: string, name: string) =>
  decode(xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))?.[1]?.trim() ?? '');

export async function fromTalks(hoursBack = 168, perChannel = 2): Promise<Candidate[]> {
  const cutoff = Date.now() - hoursBack * 3600_000;
  const feeds = await Promise.allSettled(
    Object.entries(CHANNELS).map(async ([name, id]) => {
      const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${id}`);
      if (!res.ok) throw new Error(`YouTube feed ${name}: ${res.status}`);
      const entries = (await res.text()).split('<entry>').slice(1);
      return entries
        .map((e): Candidate => {
          const title = tag(e, 'title');
          return {
            url: `https://www.youtube.com/watch?v=${tag(e, 'yt:videoId')}`,
            title,
            source: `YouTube: ${name}`,
            lane: 'my-world',
            publishedAt: tag(e, 'published'),
            snippet: (tag(e, 'media:description') || title).slice(0, 1200),
          };
        })
        .filter((c) => Date.parse(c.publishedAt ?? '') >= cutoff)
        .slice(0, perChannel);
    }),
  );

  // Every feed failing means the lane is down: throw so the brief reports it.
  if (feeds.every((f) => f.status === 'rejected')) throw (feeds[0] as PromiseRejectedResult).reason;
  return feeds.flatMap((f) => (f.status === 'fulfilled' ? f.value : []));
}
