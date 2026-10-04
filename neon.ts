import { defineConfig } from '@neon/config/v1';

// Secrets are read from your local env when `neon deploy --env .env` runs, then shipped with the function.
const secrets = [
  'EXA_API_KEY', 'SLACK_BOT_TOKEN', 'SLACK_SIGNING_SECRET', 'SLACK_CHANNEL_ID',
  'YT_CLIENT_ID', 'YT_CLIENT_SECRET', 'YT_REFRESH_TOKEN', 'BRIEF_SECRET',
];

export default defineConfig({
  aiGateway: true,
  functions: {
    signal: {
      name: 'Signal personal brief agent',
      source: 'src/index.ts',
      env: Object.fromEntries(secrets.map((k) => [k, process.env[k] ?? ''])),
    },
  },
});
