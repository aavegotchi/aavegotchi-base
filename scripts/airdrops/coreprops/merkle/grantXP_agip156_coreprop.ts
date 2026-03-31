import { run } from "hardhat";

async function addXPDrop() {
  const propId =
    "0x4166539d9aef080a824e992869ec06763d0db9c7165cc2be20768aca513473a9";

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
