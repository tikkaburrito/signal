import { neon } from '@neondatabase/serverless';
import { createHash } from 'node:crypto';

const sql = neon(process.env.DATABASE_URL!);

export const itemId = (url: string) => createHash('sha1').update(url).digest('hex').slice(0, 12);

let ready: Promise<unknown> | null = null;
export function init() {
  // Safe to repeat: runs once per isolate.
  ready ??= Promise.all([
    sql`create table if not exists sent_items (
      id text primary key, url text not null, title text not null, source text not null,
      lane text not null, tag text not null, sent_at timestamptz not null default now())`,
    sql`create table if not exists feedback (
      id bigserial primary key, item_id text not null, vote smallint not null,
      created_at timestamptz not null default now())`,
  ]).catch((err) => {
    ready = null; // let the next request retry instead of caching the failure
    throw err;
  });
  return ready;
}

export async function seenIds(): Promise<Set<string>> {
  await init();
  const rows = await sql`select id from sent_items where sent_at > now() - interval '14 days'`;
  return new Set(rows.map((r) => r.id as string));
}

export type Sent = { id: string; url: string; title: string; source: string; lane: string; tag: string };
export async function saveSent(items: Sent[]) {
  await init();
  for (const i of items) {
    await sql`insert into sent_items (id, url, title, source, lane, tag)
              values (${i.id}, ${i.url}, ${i.title}, ${i.source}, ${i.lane}, ${i.tag})
              on conflict (id) do nothing`;
  }
}

export async function saveVote(itemId: string, vote: 1 | -1) {
  await init();
  await sql`insert into feedback (item_id, vote) values (${itemId}, ${vote})`;
}

// The taste profile is derived, never hand-written: last 40 votes joined to what was sent.
export async function taste(): Promise<{ liked: string[]; disliked: string[] }> {
  await init();
  const rows = await sql`
    select f.vote, s.title, s.source, s.tag
    from feedback f join sent_items s on s.id = f.item_id
    order by f.created_at desc limit 40`;
  const line = (r: Record<string, unknown>) => `[${r.tag}] ${r.title} (${r.source})`;
  return {
    liked: rows.filter((r) => r.vote === 1).map(line),
    disliked: rows.filter((r) => r.vote === -1).map(line),
  };
}

// Public read model for the landing page: what was sent, newest first, with its net vote.
export async function history(limit = 60) {
  await init();
  return sql`
    select s.url, s.title, s.source, s.lane, s.tag, s.sent_at,
      coalesce((select sum(f.vote) from feedback f where f.item_id = s.id), 0)::int as score
    from sent_items s order by s.sent_at desc limit ${limit}`;
}
