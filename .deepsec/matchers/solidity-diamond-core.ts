import type { CandidateMatch, MatcherPlugin } from "deepsec/config";
import { regexMatcher } from "deepsec/config";

const SKIP_SOLIDITY = /(^|\/)(test|interfaces)\//;

export const solidityDiamondCore: MatcherPlugin = {
  slug: "solidity-diamond-core",
  description: "Diamond storage, selector routing, upgrade, and initialization primitives",
  noiseTier: "normal",
  filePatterns: ["contracts/**/*.sol"],
  match(content, filePath): CandidateMatch[] {
    if (SKIP_SOLIDITY.test(filePath)) return [];

    return regexMatcher(
      "solidity-diamond-core",
      [
        { regex: /\bstruct\s+AppStorage\b/, label: "slot-0 AppStorage schema" },
        { regex: /\bcontract\s+Modifiers\b/, label: "Aavegotchi modifier/auth surface" },
        { regex: /\bDIAMOND_STORAGE_POSITION\b/, label: "diamond storage position" },
        { regex: /\bdiamondStorage\s*\(/, label: "manual diamond storage accessor" },
        { regex: /\bdiamondCut\s*\(/, label: "diamond cut selector mutation" },
        { regex: /\bsetContractOwner\s*\(/, label: "diamond owner mutation" },
        { regex: /\bdelegatecall\s*\(/, label: "delegatecall initialization or dispatch" },
      ],
      content,
    );
  },
};
