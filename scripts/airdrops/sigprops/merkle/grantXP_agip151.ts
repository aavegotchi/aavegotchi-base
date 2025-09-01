import { run } from "hardhat";

async function addXPDrop() {
  const propId =
    "0xb699df969f0dfca0d5e7435b668368049e3e25ded73c0af6e73bc3906626c3d7";

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
