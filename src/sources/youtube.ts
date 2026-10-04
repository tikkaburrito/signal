import type { Candidate } from './types';

// Lane 1: my own subscriptions, via the official YouTube Data API (read-only scope).
// Cost: 1 quota unit per page of subscriptions + 1 per channel. Free tier is 10,000/day.
const API = 'https://www.googleapis.com/youtube/v3';

async function accessToken(): Promise<string | null> {
  const { YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN } = process.env;
  if (!YT_CLIENT_ID || !YT_CLIENT_SECRET || !YT_REFRESH_TOKEN) return null;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: YT_CLIENT_ID,
      client_secret: YT_CLIENT_SECRET,
      refresh_token: YT_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new Error(`YouTube token refresh failed: ${res.status} ${await res.text()}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

async function yt<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${API}/${path}`, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`YouTube ${path.split('?')[0]}: ${res.status}`);
  return (await res.json()) as T;
}

type SubsPage = {
  nextPageToken?: string;
  items: { snippet: { title: string; resourceId: { channelId: string } } }[];
};
type Uploads = {
  items: { snippet: { title: string; description: string; publishedAt: string; resourceId: { videoId: string } } }[];
};

export async function fromYouTube(hoursBack = 72, maxChannels = 60): Promise<Candidate[]> {
  const token = await accessToken();
  if (!token) return [];

  const channels: { id: string; name: string }[] = [];
  let page: string | undefined;
  do {
    const data = await yt<SubsPage>(
      `subscriptions?part=snippet&mine=true&maxResults=50&order=relevance${page ? `&pageToken=${page}` : ''}`,
      token,
    );
    for (const s of data.items) channels.push({ id: s.snippet.resourceId.channelId, name: s.snippet.title });
    page = data.nextPageToken;
  } while (page && channels.length < maxChannels);

  const cutoff = Date.now() - hoursBack * 3600_000;
  const perChannel = await Promise.allSettled(
    channels.slice(0, maxChannels).map(async (c) => {
      // Every channel's uploads playlist is its channel id with UC swapped for UU.
      const uploads = await yt<Uploads>(
        `playlistItems?part=snippet&maxResults=3&playlistId=UU${c.id.slice(2)}`,
        token,
      );
      return uploads.items
        .filter((v) => Date.parse(v.snippet.publishedAt) >= cutoff)
        .map((v): Candidate => ({
          url: `https://www.youtube.com/watch?v=${v.snippet.resourceId.videoId}`,
          title: v.snippet.title,
          source: `YouTube: ${c.name}`,
          lane: 'my-world',
          publishedAt: v.snippet.publishedAt,
          snippet: v.snippet.description.slice(0, 1200),
        }));
    }),
  );
  return perChannel.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
}
