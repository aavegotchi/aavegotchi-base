import { run } from "hardhat";

async function addXPDrop() {
  const propId =
    "0x50ae908097ccad954267677e14a9f0814a9415c90173e6d8b1d1647d29d8c553";

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
