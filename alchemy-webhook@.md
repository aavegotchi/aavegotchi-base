### Goal

- Replace n8n with a pure code pipeline to:
  - Programmatically create an Alchemy Notify webhook (GraphQL logs subscription) for a specific event on Base Mainnet.
  - Receive webhook POSTs, verify signature, and parse payload.
  - Query the Alchemy Subgraph for enriched data (with retries for eventual consistency).
  - Send a formatted Discord notification to a chosen channel.

### Inputs

- **network**: Base Mainnet
- **contract address**: `0xa99c4b08201f2913db8d28e71d020c4298f29dbf`
- **event topic**: `0x4004185f45cf5f331fe63afc9aa5aa0a0d8cfa1d6bc5d8c6cb0304136c49515c`

### High-level architecture

1. One-time CLI creates the Alchemy webhook via Notify API (default dry-run; opt-in execute).
2. A Vercel Route Handler exposes a `POST /api/alchemy/notify` endpoint.
3. On webhook delivery: verify HMAC signature, parse event, derive subgraph query inputs.
4. Query Alchemy Subgraph with retry + backoff until data is present (or timeout).
5. Format and send a Discord message via channel webhook URL.

### Repos/paths to add

- `scripts/alchemy/create-webhook.ts` (create/reuse/update; default `--dry-run`)
- `scripts/alchemy/delete-webhook.ts` (optional cleanup; default `--dry-run`)
- `scripts/alchemy/list-webhooks.ts` (optional visibility)
- `services/notify/server.ts` (Express/Fastify listener for local/server deploy)
- `services/notify/subgraph.ts` (GraphQL fetch + retry helpers)
- `services/notify/discord.ts` (Discord webhook sender + message formatting)
- `services/notify/signature.ts` (HMAC verification utilities)

### Environment variables

- `ALCHEMY_NOTIFY_TOKEN`: Alchemy Notify management token (`X-Alchemy-Token`).
- `ALCHEMY_WEBHOOK_SIGNING_SECRET`: Shared secret for request verification.
- `WEBHOOK_RECEIVER_URL`: Public URL for `POST /api/alchemy/notify`.
- `ALCHEMY_SUBGRAPH_URL`: Alchemy Subgraph HTTP endpoint.
- `ALCHEMY_SUBGRAPH_API_KEY`: If your subgraph expects `X-API-KEY`.
- `DISCORD_WEBHOOK_URL`: Discord channel webhook to post messages.
- `NODE_ENV`: `development` | `production`.

### Webhook creation (Notify API)

- Use GraphQL event webhooks targeting Base Mainnet.
- Network identifier: `BASE_MAINNET`.
- Creation endpoint: `POST https://dashboard.alchemy.com/api/create-webhook`
- Headers: `X-Alchemy-Token: ${ALCHEMY_NOTIFY_TOKEN}`, `Content-Type: application/json`
- Body (GraphQL subscription):

```json
{
  "network": "BASE_MAINNET",
  "webhook_type": "GRAPHQL",
  "webhook_url": "${WEBHOOK_RECEIVER_URL}",
  "graphql_query": {
    "query": "subscription BuyOrderLogs {\n  logs(\n    addresses: [\"0xa99c4b08201f2913db8d28e71d020c4298f29dbf\"]\n    topics: [\"0x4004185f45cf5f331fe63afc9aa5aa0a0d8cfa1d6bc5d8c6cb0304136c49515c\"]\n  ) {\n    address\n    data\n    topics\n    index\n    transaction {\n      hash\n      nonce\n      index\n      from { address }\n      to { address }\n      value\n      gasPrice\n      maxFeePerGas\n      maxPriorityFeePerGas\n      gas\n      status\n      gasUsed\n      cumulativeGasUsed\n      effectiveGasPrice\n      createdContract { address }\n    }\n    block { number timestamp hash }\n    removed\n  }\n}"
  }
}
```

- Default behavior of `scripts/alchemy/create-webhook.ts`:
  - Dry-run prints the request it would send and exits with 0.
  - When `--execute` is provided, it calls the API and prints the `webhook_id`.
  - Optional flags: `--name`, `--reuse` (finds by name, reuses/updates instead of creating).

### Listener and verification

- Expose `POST /api/alchemy/notify`.
- Validate signature using `X-Alchemy-Signature` and `ALCHEMY_WEBHOOK_SIGNING_SECRET` (HMAC SHA256 over the raw body).

```ts
import crypto from "node:crypto";

export function isValidAlchemySignature(params: {
  rawBody: Buffer;
  signatureHeader: string | undefined;
  secret: string;
}): boolean {
  if (!params.signatureHeader) return false;
  const digest = crypto
    .createHmac("sha256", params.secret)
    .update(params.rawBody)
    .digest("hex");
  const provided = params.signatureHeader.replace(/^sha256=/, "");
  const a = Buffer.from(digest, "hex");
  const b = Buffer.from(provided, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
```

- If invalid, return 401 without processing. If valid, parse JSON and continue.

### Hosting options (no always-on server)

- You do NOT need to run a Hetzner/EC2 Node server. Any serverless HTTP endpoint works:
  - Vercel Route Handler (`app/api/alchemy/notify/route.ts`) or Serverless Function
  - Cloudflare Worker (or Pages Functions)
  - AWS Lambda behind API Gateway (or Netlify/Azure/GCP equivalents)
- Signature verification needs the raw request body:
  - Next.js App Router on Vercel: use `await request.text()` for HMAC, then `JSON.parse`.
  - Cloudflare Worker: use Web Crypto `crypto.subtle` for HMAC SHA-256.
  - Lambda: sign `event.body` exactly as received.
- Timeouts and retries:
  - Keep processing under platform limits (Vercel Node: ~10–60s, Workers: ~30s CPU).
  - If subgraph lag frequently exceeds this, respond 200 fast and enqueue (Cloudflare Queues/SQS/Upstash) for out-of-band retries and Discord send.
- Secrets are stored in the platform’s env/secret manager (no self-hosted vault required).

### Subgraph query + retry

- On each webhook, derive a deterministic lookup (e.g., `txHash` + `logIndex`), then query the subgraph until the entity materializes.
- Use capped exponential backoff with jitter (e.g., 8 attempts over ~30–40s total).

```ts
interface GraphQLRequest {
  query: string;
  variables?: Record<string, unknown>;
}

export async function fetchSubgraph<T>(
  body: GraphQLRequest,
  abortSignal?: AbortSignal
): Promise<T | null> {
  const res = await fetch(process.env.ALCHEMY_SUBGRAPH_URL!, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.ALCHEMY_SUBGRAPH_API_KEY
        ? { "X-API-KEY": process.env.ALCHEMY_SUBGRAPH_API_KEY }
        : {}),
    },
    body: JSON.stringify(body),
    signal: abortSignal,
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json?.data ?? null;
}

export async function fetchWithRetry<T>(
  fn: () => Promise<T | null>,
  attempts = 8
): Promise<T> {
  let delayMs = 750;
  for (let i = 0; i < attempts; i++) {
    const out = await fn();
    if (out) return out;
    const jitter = Math.floor(Math.random() * 150);
    await new Promise((r) => setTimeout(r, delayMs + jitter));
    delayMs = Math.min(delayMs * 1.7, 8000);
  }
  throw new Error("Subgraph data not available after retries");
}
```

### Discord notification

- Send to `DISCORD_WEBHOOK_URL` with a compact message. We will iterate on content/format later.

```ts
export async function sendDiscord(content: string): Promise<void> {
  const url = process.env.DISCORD_WEBHOOK_URL!;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error(`Discord failed: ${res.status}`);
}
```

### Message content (initial draft)

- Minimal v1, tweak later:

```
Base BuyOrder Executed (ERC1155)
• Tx: {txHash}
• Token: {contract}
• Topic0: 0x4004…515c
• Block: {blockNumber}
• Details: {short decoded summary}
```

### Decoding and data mapping

- The webhook delivers `logs` entries with `topics` and `data`.
- Decode using the event ABI from the `ERC1155BuyOrderFacet` event that matches topic0.
- Map decoded fields to subgraph entity identifiers used in your Alchemy subgraph.
- If decoding fails or the subgraph row lags, keep the Discord message minimal and include links to Basescan.

### CLI commands (proposed)

- `npm run create:webhook:buy-order -- --dry-run` (default)
- `npm run create:webhook:buy-order -- --execute`
- `npm run notify:serve` (starts local listener at `http://localhost:8787/api/alchemy/notify`)

Example Node 20+ creation call (no external SDK):

```ts
async function createWebhook(params: { execute?: boolean }) {
  const body = {
    network: "BASE_MAINNET",
    webhook_type: "GRAPHQL",
    webhook_url: process.env.WEBHOOK_RECEIVER_URL,
    graphql_query: {
      query: `subscription BuyOrderLogs {\n  logs(\n    addresses: [\"0xa99c4b08201f2913db8d28e71d020c4298f29dbf\"]\n    topics: [\"0x4004185f45cf5f331fe63afc9aa5aa0a0d8cfa1d6bc5d8c6cb0304136c49515c\"]\n  ) {\n    address\n    data\n    topics\n    index\n    transaction {\n      hash\n      nonce\n      index\n      from { address }\n      to { address }\n      value\n      gasPrice\n      maxFeePerGas\n      maxPriorityFeePerGas\n      gas\n      status\n      gasUsed\n      cumulativeGasUsed\n      effectiveGasPrice\n      createdContract { address }\n    }\n    block { number timestamp hash }\n    removed\n  }\n}`,
    },
  };

  if (!params.execute) {
    console.log(
      "[dry-run] POST /api/create-webhook",
      JSON.stringify(body, null, 2)
    );
    return;
  }

  const res = await fetch("https://dashboard.alchemy.com/api/create-webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Alchemy-Token": process.env.ALCHEMY_NOTIFY_TOKEN!,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  console.log("create-webhook response:", json);
}
```

### Idempotency and duplicates

- Deduplicate on `{txHash}:{logIndex}`; keep a short-lived in-memory LRU (or Redis if deployed) to avoid double-posts from retries/reorgs.
- Consider requiring 1–2 confirmations in the webhook config to reduce reorg noise.

### Testing plan

- Local: tunnel your listener (e.g., `cloudflared`/`ngrok`) and set `WEBHOOK_RECEIVER_URL` to the tunnel URL.
- Create the webhook in dry-run, then execute.
- Trigger a real event on Base (or replicate on Base Sepolia with a test webhook) and observe logs.
- Validate signature, subgraph retries, and Discord send.
- Iterate on message formatting.

### Rollout

- Phase 1: Create a staging webhook (Base Sepolia) pointing at staging listener + staging Discord.
- Phase 2: Create prod webhook on Base Mainnet; point to prod listener; initially paused or low-traffic.
- Phase 3: Observe, fine-tune retry/backoff and message.

### Risks and mitigations

- Subgraph lag: handled via exponential backoff with cap; fall back to minimal message if timeout.
- Reorgs/duplicates: confirmations + `{txHash}:{logIndex}` dedupe set.
- Signature verification: hard fail on invalid signature; log and drop.
- Discord failures: catch and retry once with small delay; log errors.

### Open items to confirm (if needed)

- Exact subgraph entity/fields to query for enrichment.
- Desired Discord message schema (fields, links, emojis, formatting).
- Whether to add `list/update/delete` webhook scripts now or later.
