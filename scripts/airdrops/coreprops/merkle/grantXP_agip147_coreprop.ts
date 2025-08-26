import { run } from "hardhat";

async function addXPDrop() {
  const propId =
    "0x55d5964f47c7bd7c678561a3fd76ad206e74f6e06a8668e687e194fbc63e853e";

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
