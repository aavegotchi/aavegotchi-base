import { run } from "hardhat";

async function addXPDrop() {
  const propId =
    "0x67b64dbacac56cb850c74a3f1b3440d1e1fcbcc0ba3215e83c75c5419ea99d85";

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
