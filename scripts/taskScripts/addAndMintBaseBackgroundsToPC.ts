import { run } from "hardhat";
import { AddAndMintWearablesToForgeTaskArgs } from "../../tasks/addAndMintWearables";
import { varsForNetwork } from "../../helpers/constants";
import { ethers } from "hardhat";
import { PC_WALLET } from "../geistBridge/paths";

export async function addAndMintBaseBackgroundsToPC() {
  const itemIdsArray = [421, 422, 423, 424, 425, 426];
  const itemIds = itemIdsArray.join(",");

  console.log(`\n📋 Item IDs to process: ${itemIds}`);

  const c = await varsForNetwork(ethers);

  const args: AddAndMintWearablesToForgeTaskArgs = {
    itemIds: itemIds,
    recipient: PC_WALLET,
  };

  console.log(`\n🚀 Running deployment task with item IDs: ${itemIds}`);

  // Run the main deployment task (which includes validation)
  await run("addAndMintBaseWearables", args);
}

if (require.main === module) {
  addAndMintBaseBackgroundsToPC()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

exports.addAndMintBaseBackgroundsToPC = addAndMintBaseBackgroundsToPC;
