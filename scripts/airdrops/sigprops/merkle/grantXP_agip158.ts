import { run } from "hardhat";

async function addXPDrop() {
  const propId =
    "0x7fd90c724350c567d202a94466cc495962b4f092a554e23dcd23fa1e4cb5a704";

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
