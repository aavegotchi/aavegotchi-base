import { run } from "hardhat";

async function addXPDrop() {
  const propId =
    "0xfb4fc4a410deba2867aa1b6b31a1b543696f60e789f05fbf07cae6b2be9bbeea";

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
