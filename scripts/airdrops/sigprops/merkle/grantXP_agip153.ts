import { run } from "hardhat";

async function addXPDrop() {
  const propId =
    "0xf89ed7b4afa8031df5c79bcd58054221074dab8a3606d34b85d78886c3965654";

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
