import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Brief } from './agent';
import type { Candidate } from './sources/types';
import { itemId } from './db';

const LANE_LABEL = { 'my-world': 'From your feeds', 'outside-my-bubble': 'Outside your bubble' } as const;

export function briefBlocks(brief: Brief, picked: Candidate[]) {
  const date = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  const blocks: unknown[] = [
    { type: 'header', text: { type: 'plain_text', text: `Signal · ${date}` } },
    { type: 'section', text: { type: 'mrkdwn', text: `_${brief.opener}_` } },
  ];
  brief.items.forEach((it, n) => {
    const c = picked[n];
    blocks.push(
      { type: 'divider' },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${n + 1}. <${c.url}|${it.headline}>*\n${it.learning}\n*Why you:* ${it.whyYou}\n*Do today:* ${it.action}`,
        },
      },
      { type: 'context', elements: [{ type: 'mrkdwn', text: `${LANE_LABEL[c.lane]} · ${c.source} · \`${it.tag}\`` }] },
      {
        type: 'actions',
        elements: [
          { type: 'button', action_id: 'vote_up', value: itemId(c.url), text: { type: 'plain_text', text: '👍 More like this' } },
          { type: 'button', action_id: 'vote_down', value: itemId(c.url), text: { type: 'plain_text', text: '👎 Less of this' } },
        ],
      },
    );
  });
  return blocks;
}

export async function postToSlack(text: string, blocks?: unknown[]) {
  const res = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`, 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ channel: process.env.SLACK_CHANNEL_ID, text, blocks, unfurl_links: false }),
  });
  const data = (await res.json()) as { ok: boolean; error?: string };
  if (!data.ok) throw new Error(`Slack chat.postMessage: ${data.error}`);
}

// Slack signs every request. Reject anything that isn't from our app or is older than 5 minutes.
export function verifySlack(request: Request, rawBody: string): boolean {
  const secret = process.env.SLACK_SIGNING_SECRET;
  const ts = request.headers.get('x-slack-request-timestamp');
  const sig = request.headers.get('x-slack-signature');
  if (!secret || !ts || !sig || Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const expected = 'v0=' + createHmac('sha256', secret).update(`v0:${ts}:${rawBody}`).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}
