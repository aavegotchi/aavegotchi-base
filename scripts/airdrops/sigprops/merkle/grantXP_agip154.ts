import { run } from "hardhat";

async function addXPDrop() {
  const propId =
    "0xa0bdb8d05a900580870702f0518e10a7084561b7a1e099a2dea38d1155913c26";

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
