import { run } from "hardhat";

async function addXPDrop() {
  const propId =
    "0x520b143c30f00b46476316670dae39ff8f2dff0f83f5234c14246a50c862f34e";

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
