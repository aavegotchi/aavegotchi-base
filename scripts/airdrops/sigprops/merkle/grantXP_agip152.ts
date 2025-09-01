import { run } from "hardhat";

async function addXPDrop() {
  const propId =
    "0xfcf7bb54537fcbf9c3fa181a4dbcd525702c52b1e01d24e72e735d46564b4bb4";

  await run("deployXPDrop", {
    proposalId: propId,
  });
}

addXPDrop()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

exports.grantXP = addXPDrop;
