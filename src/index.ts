import { waitUntil } from '@neon/functions';
import { runBrief } from './brief';
import { saveVote } from './db';
import { postToSlack, verifySlack } from './slack';

const run = (focus?: string) =>
  runBrief(focus).catch(async (err) => {
    console.error(err);
    await postToSlack(`Signal failed: ${err instanceof Error ? err.message : String(err)}`).catch(() => {});
    throw err;
  });

export default {
  async fetch(request: Request) {
    const { pathname } = new URL(request.url);
    if (request.method !== 'POST') return new Response('Signal is running', { status: 200 });

    // 1. Scheduled or manual trigger: curl -X POST <url>/brief -H "authorization: Bearer $BRIEF_SECRET"
    if (pathname === '/brief') {
      const secret = process.env.BRIEF_SECRET;
      if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
        return new Response('unauthorized', { status: 401 });
      }
      const body = (await request.json().catch(() => ({}))) as { focus?: string };
      return Response.json(await run(body.focus));
    }

    const raw = await request.text();
    if (!verifySlack(request, raw)) return new Response('bad signature', { status: 401 });
    const form = new URLSearchParams(raw);

    // 2. Slash command: /brief  or  /brief voice agents only
    if (pathname === '/slack/command') {
      waitUntil(run(form.get('text')?.trim() || undefined).catch(() => {}));
      return Response.json({ response_type: 'ephemeral', text: 'Reading your feeds and the rest of the internet…' });
    }

    // 3. Button clicks on a brief: store the vote, confirm quietly.
    if (pathname === '/slack/interact') {
      const payload = JSON.parse(form.get('payload') ?? '{}') as {
        response_url?: string;
        actions?: { action_id: string; value: string }[];
      };
      const action = payload.actions?.[0];
      if (action && payload.response_url) {
        const up = action.action_id === 'vote_up';
        waitUntil(
          saveVote(action.value, up ? 1 : -1).then(() =>
            fetch(payload.response_url!, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                response_type: 'ephemeral',
                replace_original: false,
                text: up ? 'Noted. More like this tomorrow.' : 'Noted. Less of this from now on.',
              }),
            }),
          ),
        );
      }
      return new Response(null, { status: 200 });
    }

    return new Response('not found', { status: 404 });
  },
};
