export type Lane = 'my-world' | 'outside-my-bubble';

export type Candidate = {
  url: string;
  title: string;
  source: string; // "YouTube: Lenny's Podcast", "Exa: news", "X: @handle"
  lane: Lane;
  publishedAt?: string;
  snippet: string;
};
