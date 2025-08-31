import { run } from "hardhat";
import { AddAndMintWearablesToForgeTaskArgs } from "../../tasks/addAndMintWearablesToForge";
import { confirmChecklist } from "../newWearableChecklist";

async function addAndMintBaseWearablesToForge() {
  const itemIdsArray = [418, 419, 420, 421];
  const itemIds = itemIdsArray.join(",");

  console.log(`\n📋 Item IDs to process: ${itemIds}`);

  const shouldProceed = await confirmChecklist(itemIdsArray);
  if (!shouldProceed) {
    console.log("❌ Deployment cancelled by user.");
    process.exit(0);
  }

  const args: AddAndMintWearablesToForgeTaskArgs = {
    itemIds: itemIds,
  };

  console.log(
    `Running addAndMintBaseWearablesToForge task with item IDs: ${itemIds}`
  );
  await run("addAndMintBaseWearablesToForge", args);
}

addAndMintBaseWearablesToForge()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

exports.addAndMintBaseWearablesToForge = addAndMintBaseWearablesToForge;
