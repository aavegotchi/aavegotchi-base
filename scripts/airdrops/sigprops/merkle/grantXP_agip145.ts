import { run } from "hardhat";

async function addXPDrop() {
  const propId =
    "0x1901aa0b9476a7a4d8e5e0c8f19bfe79f3939b9e4e09ca490721218ebab27245";

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
