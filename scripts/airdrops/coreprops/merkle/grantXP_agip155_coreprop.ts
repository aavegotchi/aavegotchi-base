import { run } from "hardhat";

async function addXPDrop() {
  const propId =
    "0x7100d11d47d82da653e82eebfde8b5208ffc45f94d8d52e5e1f09b92ab871f09";

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
