import { run } from "hardhat";

async function addXPDrop() {
  const propId =
    "0xdb7475e47988273620679e539df424f793394682b9191ab578d8f726867659bb";

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
