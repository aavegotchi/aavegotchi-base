import { run } from "hardhat";

async function addXPDrop() {
  const propId =
    "0xc01b7199f950af55a3c4ccd1ae4eeef74e0bea3b09f0f643dce7ba9b67f125e7";

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

exports.grantXP = addXPDrop;
