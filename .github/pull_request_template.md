## Summary

## Testing

- [ ] `forge build --sizes`
- [ ] `npx hardhat compile`
- [ ] `forge test` (if applicable)
- [ ] `npm test` (if applicable)

## Checklist

- [ ] No secrets committed (for example `.env`, private keys, API keys)
- [ ] If `AppStorage` changed: append-only (no reordering/removals/type changes)
- [ ] Diamond auth paths use the correct sender pattern (`LibMeta.msgSender()` vs `msg.sender`)
- [ ] Docs updated (if behavior or public API changed)

