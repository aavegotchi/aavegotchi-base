import { run } from "hardhat";

async function addXPDrop() {
  const propId =
    "0x0137aeee8ac0eb079d47a9ce21c389762dfcab36231d4539661bcf8cc88ec128";

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
