# Signal

A personal brief agent. It reads what you follow (YouTube subscriptions now, X next) and what you
don't (Exa), keeps only what matters for what you're building, posts 5 learnings to Slack, and
changes tomorrow's brief based on which ones you 👍 or 👎.

Built on Neon's `with-mastra` starter: Mastra agent, Neon AI Gateway, Neon Postgres, Neon Functions.

## How it works

```
YouTube subscriptions ─┐
Exa (web, news, pods) ─┼─> dedupe vs. sent ─> curator agent ─> Slack brief ─> 👍/👎 ─┐
(X, newsletters next) ─┘        (Neon)      (profile + taste)                        │
                                    ^────────────── taste (Neon) <───────────────────┘
```

| File | Job |
| --- | --- |
| `src/profile.ts` | Who you are and what you're building. Edit this first. |
| `src/sources/*` | One file per lane. Each returns `Candidate[]` and fails independently. |
| `src/sources/x.ts` | What AI CEOs and influencers posted on X, found through Exa (mirrors and coverage that quotes them). |
| `src/agent.ts` | Curator agent + the structured output schema. |
| `src/brief.ts` | The pipeline. |
| `src/slack.ts` | Block Kit message, request signature check. |
| `src/db.ts` | `sent_items` and `feedback` tables (auto-created). |
| `src/index.ts` | Routes: `POST /brief`, `/slack/command`, `/slack/interact`. |

## Setup (about 15 minutes)

1. Install and link
   ```bash
   npm install
   npm i -g neon && neon login && neon link
   cp .env.example .env    # then `neon env pull` fills in the Neon values
   ```
2. Exa: put your key in `EXA_API_KEY`.
3. Slack: go to api.slack.com/apps > Create New App > From a manifest, and paste the manifest below.
   Install it to your workspace, copy the Bot Token and Signing Secret into `.env`, then run
   `/invite @Signal` in the channel you want and put that channel's ID in `SLACK_CHANNEL_ID`.
4. First brief, locally (no public URL needed):
   ```bash
   neon dev
   curl -X POST http://localhost:8787/brief -H "authorization: Bearer $BRIEF_SECRET"
   ```
5. Deploy, then wire Slack to the live URL:
   ```bash
   neon deploy --env .env
   neon env pull            # prints/writes NEON_FUNCTION_SIGNAL_BASE_URL
   ```
   In the Slack app, replace `YOUR-FUNCTION-URL` in the slash command and interactivity URLs.
   Now `/brief` and the buttons work. `/brief voice agents only` runs a focused brief.

### Slack app manifest

```yaml
display_information:
  name: Signal
features:
  bot_user:
    display_name: Signal
  slash_commands:
    - command: /brief
      url: https://YOUR-FUNCTION-URL/slack/command
      description: Get your brief now
      usage_hint: "[optional focus]"
oauth_config:
  scopes:
    bot:
      - chat:write
      - commands
settings:
  interactivity:
    is_enabled: true
    request_url: https://YOUR-FUNCTION-URL/slack/interact
```

### YouTube lane (optional, about 10 minutes)

1. Google Cloud console: enable "YouTube Data API v3", create an OAuth client (type: Web application)
   with redirect URI `https://developers.google.com/oauthplayground`.
2. Open the OAuth Playground, click the gear, tick "Use your own OAuth credentials", paste the
   client ID and secret.
3. Authorize the scope `https://www.googleapis.com/auth/youtube.readonly`, exchange the code,
   and copy the refresh token into `YT_REFRESH_TOKEN`.

## Daily schedule

`.github/workflows/daily-brief.yml` runs every day at 7:00 AM Pacific and on demand
(`gh workflow run "Daily brief"`). It needs two repo secrets: `SIGNAL_URL` (the function base URL,
no trailing slash) and `BRIEF_SECRET`.

Anything else that can send one HTTP request works too: a Fly.io scheduled machine, etc.

```bash
curl -X POST "$NEON_FUNCTION_SIGNAL_BASE_URL/brief" -H "authorization: Bearer $BRIEF_SECRET"
```
