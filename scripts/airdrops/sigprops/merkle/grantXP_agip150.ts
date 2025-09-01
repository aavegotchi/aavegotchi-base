import { run } from "hardhat";

async function addXPDrop() {
  const propId =
    "0x5653c17a4a0cb4b9f227c2730e3428853eb9a6304d62865f233f759549aa7930";

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
