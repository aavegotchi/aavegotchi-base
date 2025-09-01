import { run } from "hardhat";

async function addXPDrop() {
  const propId =
    "0x525d47507adfb3285ce767795e72d74123a1b2d727ee9834a421dc364b46ad6f";

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
