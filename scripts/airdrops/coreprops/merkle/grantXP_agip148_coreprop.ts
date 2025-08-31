import { run } from "hardhat";

async function addXPDrop() {
  const propId =
    "0x271854264b3f3070977d276b5a5345ab52f24817ee0933925460cdcf41e243bb";

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
