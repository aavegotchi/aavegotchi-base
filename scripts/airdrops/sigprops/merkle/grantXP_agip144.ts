import { run } from "hardhat";

async function addXPDrop() {
  const propId =
    "0x05c54d61873358d9007a605fee806c5383bc8e4649ae12a3bd2ab82c312d5a8d";

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
