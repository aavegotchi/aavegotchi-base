import { run } from "hardhat";

async function addXPDrop() {
  const propId =
    "0xfc000e731e1e01380da2ab61cf7420ef83cc7b86b3da32be8a400a6ae8b84e57";

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
