## Summary

## Testing

- [ ] `./scripts/fast-check.sh`

## Deploy Evidence

- URL (or `N/A` with reason):

## Checklist

- [ ] Feature/bug changes include tests
- [ ] Fast-check gate passed locally
- [ ] No secrets committed (for example `.env`, private keys, API keys)
- [ ] If `AppStorage` changed: append-only (no reordering/removals/type changes)
- [ ] Diamond auth paths use the correct sender pattern (`LibMeta.msgSender()` vs `msg.sender`)
- [ ] Docs updated (if behavior or public API changed)
