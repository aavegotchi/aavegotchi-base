import { run } from "hardhat";

async function addXPDrop() {
  const propId =
    "0x1e880963be83c2a417edf4fad7e9d05f5c37396b5d16810003a481d8d91746c7";

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
