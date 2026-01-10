import { task } from "hardhat/config";
import { execSync } from "child_process";
import * as readline from "readline";
import {
  captureDiamondSnapshot,
  loadFacetCatalog,
  readSnapshotHistory,
  writeSnapshotHistory,
  resolveChainId,
} from "../scripts/utils/diamondState";
import { chainAddressesMap } from "../scripts/helperFunctions";
import { networkAddresses } from "../helpers/constants";
import { mine } from "@nomicfoundation/hardhat-network-helpers";

function promptYesNo(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(message, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === "y");
    });
  });
}

task(
  "snap",
  "Capture the current on-chain diamond state into current_diamond_state.json"
)
  .addOptionalParam("diamond", "Override diamond address")
  .setAction(async ({ diamond }, hre) => {
    await hre.run("compile");
    const catalog = await loadFacetCatalog(hre);
    const effectiveChainId = Number(await resolveChainId(hre));
    const testing = ["hardhat", "localhost"].includes(hre.network.name);
    if (testing) {
      await mine();
    }

    let diamondAddress: string | undefined = diamond;
    if (!diamondAddress || diamondAddress === "") {
      const constantsEntry = networkAddresses[effectiveChainId];
      const helperEntry = chainAddressesMap[effectiveChainId];
      diamondAddress =
        constantsEntry?.aavegotchiDiamond || helperEntry?.aavegotchiDiamond;
    }
    if (!diamondAddress) {
      throw new Error(
        "Diamond address not provided and no fallback available for this chain. Pass --diamond <address>."
      );
    }

    const existingSnapshot = await readSnapshotHistory(hre, diamondAddress);
    if (existingSnapshot) {
      const proceed = await promptYesNo(
        `A snapshot already exists for ${diamondAddress}. Overwrite it? (y/N): `
      );
      if (!proceed) {
        console.log("Snapshot aborted.");
        return;
      }
    }

    console.log(
      `Capturing diamond snapshot for ${diamondAddress} on chain ${effectiveChainId}...`
    );
    const snapshot = await captureDiamondSnapshot(hre, diamondAddress, catalog);
    snapshot.commit = execSync("git rev-parse HEAD").toString().trim();
    await writeSnapshotHistory(hre, snapshot);
    console.log("Snapshot persisted to current_diamond_state.json.");
  });
