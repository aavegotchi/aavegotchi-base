### Context

- **name**: Aavegotchi Base ERC1155 Buy Order
- **network**: Base Mainnet
- **contract address**: `0xa99c4b08201f2913db8d28e71d020c4298f29dbf`
- **topic0**: `0xb89a3fa09a6b61b06fa0f16a43b319ca184062389055411b6e698cabdf7e9edc`

### Questions

1. **Receiving endpoint**

- What is the destination `webhook_url` (prod and, if applicable, staging)?
- Do you want request verification enabled (e.g., HMAC/`X-Alchemy-Signature`)? If yes, please provide or confirm a shared secret/env var name.

2. **Alchemy account/app & auth**

- Which Alchemy app/project should own this webhook? Please provide the App ID (or confirm which app by name).
- Please provide the Notify/Webhooks management token for the `X-Alchemy-Token` header. Preferred env var name (ok?): `ALCHEMY_NOTIFY_TOKEN`.

3. **Webhook type**

- Use GraphQL/event webhooks (recommended) or legacy logs filter webhooks? If GraphQL, I will subscribe to logs for the contract with the provided `topic0`.

4. **Network identifier**

- Confirm the exact network identifier Alchemy expects for Base Mainnet (I plan to use `base-mainnet`).

5. **Event ABI & decoding**

- Please provide the ABI of the event corresponding to the given `topic0` so we can decode payloads downstream (event name and parameter types).
- Should the receiving service decode and log structured fields, or keep raw topics/data?

6. **Filter scope**

- Restrict strictly to the single contract above, correct?
- Any additional topic filters (e.g., topic1..topic3 such as buyer address, tokenId) or is `topic0`-only sufficient?
- Any value thresholds or allowlist/denylist constraints to apply?

7. **Confirmations / reorg safety**

- How many block confirmations should we require before delivery (0/1/2+)? If unspecified, I will use the Alchemy default for logs.

8. **Activation**

- Create the webhook as active immediately, or create paused and activate later?

9. **Idempotency & conflicts**

- If a webhook with the same name already exists on Base Mainnet, should the script: (a) reuse it, (b) update it in place, or (c) create a new one and leave the old one untouched?

10. **Secrets & persistence**

- Where should secrets live (root `.env`)? Any preferred env var names besides `ALCHEMY_NOTIFY_TOKEN` and `ALCHEMY_WEBHOOK_SIGNING_SECRET`?
- After creation, should we persist the new `webhook_id` to a local config (e.g., `deployment-config.json`) or just print it to stdout for manual storage?

11. **Script interface & location**

- Location preference: `scripts/alchemy/create-webhook.ts`?
- Add an npm script like `create:webhook:buy-order`? Any naming preference?
- Default behavior to `--dry-run` (no network changes) unless `--execute` is passed?
- Node version to target (Node 18/20) so we can rely on native `fetch`?

12. **Monitoring & testing**

- Do you want the script to optionally send a quick validation request or test ping (if supported), or just create and exit?
- Any Slack/alerting integration you want the script to emit upon success/failure?

13. **Deletion/cleanup**

- Should I also add a companion script to disable/delete the webhook by name/ID?

14. **Environments**

- Do you want a Base Sepolia (testnet) variant created with the same filters for pre-prod validation?

### Answer format (please fill in)

- **webhook_url (prod)**:
- **webhook_url (staging/dev)**:
- **alchemy app id / project**:
- **alchemy notify token env var/value available**:
- **webhook type**: GraphQL | Logs (legacy)
- **network identifier**: `base-mainnet` (confirm or provide alternate)
- **event ABI (name + inputs)**:
- **extra filters (topic1..3, allowlists, thresholds)**:
- **min confirmations**:
- **activation on create**: active | paused
- **conflict policy**: reuse | update | create-new
- **secrets storage**: `.env` | other (specify)
- **persist webhook_id**: config file | stdout only (specify file if config)
- **script path & npm script name**:
- **default dry-run and flag name**:
- **node version**:
- **need companion delete/disable script**: yes | no
- **need testnet variant (Base Sepolia)**: yes | no

erc1155execuedlistingtorecipient topic: 0x4004185f45cf5f331fe63afc9aa5aa0a0d8cfa1d6bc5d8c6cb0304136c49515c

https://basescan.org/tx/0x60ac63951d81e8bab8ca0ccd1dbfd55e366e308d2b76ed4173483c6fd04c507a#eventlog
