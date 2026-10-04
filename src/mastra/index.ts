import { Mastra } from '@mastra/core/mastra';
import { curator } from '../agent';

export const mastra = new Mastra({ agents: { curator } });
