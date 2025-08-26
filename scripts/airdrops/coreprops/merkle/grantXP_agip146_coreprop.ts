import { run } from "hardhat";

async function addXPDrop() {
  const propId =
    "0x866a74f31e2c2cb29bbcfee043f69080c7c9377dc64d6fe261ae428b022c72ab";

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
