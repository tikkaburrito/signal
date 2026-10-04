import { Agent } from '@mastra/core/agent';
import { z } from 'zod';
import { PROFILE } from './profile';

export const briefSchema = z.object({
  opener: z.string().describe('One sentence: the single theme connecting today. No greeting.'),
  items: z
    .array(
      z.object({
        index: z.number().int().describe('Index of the candidate this is based on'),
        headline: z.string().describe('Plain headline, max 12 words, no clickbait'),
        learning: z.string().describe('The one thing worth knowing, 1-2 sentences, concrete'),
        whyYou: z.string().describe('Why this matters to this specific person, 1 sentence'),
        action: z.string().describe('One thing they could do today, starting with a verb'),
        tag: z.string().describe('2-3 word topic tag, lowercase, e.g. "agent frameworks"'),
      }),
    )
    .min(3)
    .max(6),
});
export type Brief = z.infer<typeof briefSchema>;

export const curator = new Agent({
  id: 'curator',
  name: 'curator',
  model: 'neon/claude-sonnet-5',
  instructions: `You are a personal curator. You turn a pile of candidate links into a short brief of
learnings for one person. You are ruthless: most candidates are noise and get dropped.

THE PERSON
${PROFILE}

RULES
- Pick 5 items (fewer if the pile is weak). Aim for a mix: at least 2 from "my-world" when
  available, at least 2 from "outside-my-bubble", and at least 1 genuinely positive world story.
- Sources starting "X voices" carry what AI CEOs and influencers posted on X. Include at least 1
  when available, and name the person in the headline.
- Sources starting "YouTube" are podcasts, YC videos and conference talks. Include at least 1 when
  available, and say who is speaking.
- Rank by usefulness to this person, not by how viral something is.
- Only state what the candidate's title and snippet support. Never invent numbers, quotes or
  claims. If a snippet is too thin to extract a real learning, drop the candidate.
- "whyYou" must reference their actual projects or goals, not generic advice.
- Their past reactions are the strongest signal you have. Lean hard into topics and sources
  they liked; avoid the topics and sources they disliked.
- Write like a sharp friend texting. No hype words, no emojis.`,
});
