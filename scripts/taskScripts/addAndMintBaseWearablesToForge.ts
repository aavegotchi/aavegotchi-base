import { run } from "hardhat";
import { AddAndMintWearablesToForgeTaskArgs } from "../../tasks/addAndMintWearablesToForge";

async function addAndMintBaseWearablesToForge() {
  const itemIds = [418, 419, 420].join(",");

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
