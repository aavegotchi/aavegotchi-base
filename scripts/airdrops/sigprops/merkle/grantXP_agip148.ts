import { run } from "hardhat";

async function addXPDrop() {
  const propId =
    "0xe8906169a51a7423475ff3a6c327247888bbdbb3db0154a34dcd0c5cc47967b4";

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
