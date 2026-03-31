import { run } from "hardhat";

async function addXPDrop() {
  const propId =
    "0x6b80d6062599ba4e6293e5476015d7c595383721b713972759c276c017a615fd";

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
