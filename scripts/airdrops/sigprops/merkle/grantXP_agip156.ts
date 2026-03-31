import { run } from "hardhat";

async function addXPDrop() {
  const propId =
    "0x1d954d7c509a48189a8b45fbe73c08839031c43768a0e3f8009b722c856cfe3c";

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
