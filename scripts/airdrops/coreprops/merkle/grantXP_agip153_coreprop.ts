import { run } from "hardhat";

async function addXPDrop() {
  const propId =
    "0x47233a0e0e533c463c0994dcb70f1584095b324e4072cf79d8b8e3cd8f2b70b1";

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
