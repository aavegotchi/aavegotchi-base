import type { CandidateMatch, MatcherPlugin } from "deepsec/config";
import { regexMatcher } from "deepsec/config";

const SKIP_SOLIDITY = /(^|\/)(test|interfaces)\//;

export const soliditySensitiveOperation: MatcherPlugin = {
  slug: "solidity-sensitive-operation",
  description: "Solidity auth, meta-transaction, token-flow, callback, and privileged-state primitives",
  noiseTier: "normal",
  filePatterns: ["contracts/**/*.sol"],
  match(content, filePath): CandidateMatch[] {
    if (SKIP_SOLIDITY.test(filePath)) return [];

    return regexMatcher(
      "solidity-sensitive-operation",
      [
        { regex: /\bLibMeta\.msgSender\s*\(/, label: "meta-transaction-aware sender" },
        { regex: /\bmsg\.sender\b/, label: "raw caller identity" },
        { regex: /\becrecover\s*\(/, label: "signature recovery" },
        { regex: /\.(?:call|delegatecall)\s*(?:\{|\()/, label: "low-level external call" },
        { regex: /\b(?:safeTransferFrom|transferFrom)\s*\(/, label: "token transfer from another account" },
        { regex: /\b(?:safeTransfer|transfer)\s*\(/, label: "token transfer out" },
        { regex: /\bs\.(?:dao|daoTreasury|daoDirectorTreasury|itemManagers|gameManagers|baseRelayer|relayerPetter|VRFSystem|diamondPaused)\b/, label: "privileged config state" },
        { regex: /\bs\.(?:aavegotchis|erc721Listings|erc1155Listings|gotchiLendings|erc721BuyOrders|erc1155BuyOrders|whitelists)\b/, label: "funds or ownership accounting state" },
      ],
      content,
    );
  },
};
