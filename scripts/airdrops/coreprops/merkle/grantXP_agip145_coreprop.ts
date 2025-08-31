import { run } from "hardhat";

async function addXPDrop() {
  const propId =
    "0xcf7ad9ce9e596b4b326ddd645cf0a6f203b4f042751038a1f82c423dc57c7ac8";

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
