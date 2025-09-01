import { run } from "hardhat";

async function addXPDrop() {
  const propId =
    "0x919a857d0953d9aca2aaba659660f1f098776665d591e934bdf80ee0fce87ca2";

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
