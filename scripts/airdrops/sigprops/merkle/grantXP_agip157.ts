import { run } from "hardhat";

async function addXPDrop() {
  const propId =
    "0xc5747de71c3c5313a1b86dc6011b8aa7f2bc3818e2136fe3720b59e4ff0b9dd1";

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
