import { run } from "hardhat";

async function addXPDrop() {
  const propId =
    "0x9ea2ee26c83699b8c9e773d6d693a0051a4c42b36bd67bb6c5a3aa8d8fe9a759";

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
