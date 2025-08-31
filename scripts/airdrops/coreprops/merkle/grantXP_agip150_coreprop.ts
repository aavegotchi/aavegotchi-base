import { run } from "hardhat";

async function addXPDrop() {
  const propId =
    "0x3f326aa347728c09fcc1d40dabd4c3248cd11dff9fcb0d26a4483dfc6400498f";

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
