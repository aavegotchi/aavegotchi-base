import { run } from "hardhat";

async function addXPDrop() {
  const propId =
    "0x378153f1fe22c673bb57d4c421b6ef93f5562f806317950be7c189547c0458c2";

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
