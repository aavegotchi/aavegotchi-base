import { run } from "hardhat";
import { AddAndMintWearablesToForgeTaskArgs } from "../../tasks/addAndMintWearablesToForge";

async function addAndMintBaseWearablesToForge() {
  const itemIdsArray = [418, 419, 420];
  const itemIds = itemIdsArray.join(",");

  console.log(`\n📋 Item IDs to process: ${itemIds}`);

  const args: AddAndMintWearablesToForgeTaskArgs = {
    itemIds: itemIds,
  };

  console.log(`\n🚀 Running deployment task with item IDs: ${itemIds}`);

  // Run the main deployment task (which includes validation)
  await run("addAndMintBaseWearablesToForge", args);
}

addAndMintBaseWearablesToForge()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

exports.addAndMintBaseWearablesToForge = addAndMintBaseWearablesToForge;
