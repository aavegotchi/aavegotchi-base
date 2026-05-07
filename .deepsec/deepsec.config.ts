import { defineConfig, type DeepsecPlugin } from "deepsec/config";
import { solidityDiamondCore } from "./matchers/solidity-diamond-core.js";
import { solidityFacetEntrypoint } from "./matchers/solidity-facet-entrypoint.js";
import { soliditySensitiveOperation } from "./matchers/solidity-sensitive-operation.js";

const aavegotchiPlugin: DeepsecPlugin = {
  name: "aavegotchi-solidity",
  matchers: [solidityDiamondCore, solidityFacetEntrypoint, soliditySensitiveOperation],
};

export default defineConfig({
  defaultAgent: "codex",
  projects: [
    {
      id: "aavegotchi-geist",
      root: "..",
      priorityPaths: [
        "contracts/Aavegotchi/",
        "contracts/shared/",
        "contracts/GHST/",
        "contracts/WGHST/",
        "tasks/",
        "scripts/",
      ],
    },
    // <deepsec:projects-insert-above>
  ],
  plugins: [aavegotchiPlugin],
});
