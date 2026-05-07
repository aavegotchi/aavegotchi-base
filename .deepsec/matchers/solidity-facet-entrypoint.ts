import type { CandidateMatch, MatcherPlugin } from "deepsec/config";

const ENTRYPOINT_RE = /\bfunction\s+\w+\s*\([^;{]*\)\s*(?:external|public)\b/;

export const solidityFacetEntrypoint: MatcherPlugin = {
  slug: "solidity-facet-entrypoint",
  description: "Production Solidity files exposing public/external protocol entrypoints",
  noiseTier: "noisy",
  filePatterns: [
    "contracts/Aavegotchi/facets/*.sol",
    "contracts/Aavegotchi/ForgeDiamond/facets/*.sol",
    "contracts/Aavegotchi/WearableDiamond/facets/*.sol",
    "contracts/Aavegotchi/vrf/*.sol",
    "contracts/GHST/facets/*.sol",
    "contracts/WGHST/*.sol",
    "contracts/periphery/*.sol",
    "contracts/raffle/*.sol",
    "contracts/shared/facets/*.sol",
  ],
  match(content): CandidateMatch[] {
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      if (!ENTRYPOINT_RE.test(lines[i])) continue;

      const start = Math.max(0, i - 3);
      const end = Math.min(lines.length, i + 10);
      return [
        {
          vulnSlug: "solidity-facet-entrypoint",
          lineNumbers: [i + 1],
          snippet: lines.slice(start, end).join("\n"),
          matchedPattern: "production Solidity file with public/external entrypoint",
        },
      ];
    }

    return [];
  },
};
