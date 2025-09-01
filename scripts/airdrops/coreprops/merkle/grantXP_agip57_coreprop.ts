import { run } from "hardhat";

async function addXPDrop() {
  const propId =
    "0x1930189873f7591fa60fc108d632c0f11fc35d8fff3eaccc349d05756c54c321";

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
