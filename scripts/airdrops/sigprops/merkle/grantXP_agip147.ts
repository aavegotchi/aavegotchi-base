import { run } from "hardhat";

async function addXPDrop() {
  const propId =
    "0x8208eab9425d5c4c1dd0057d6287ba6d6d80f3758e19304ffbef4f132bbea248";

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
