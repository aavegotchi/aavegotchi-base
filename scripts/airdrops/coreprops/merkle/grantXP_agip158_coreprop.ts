import { run } from "hardhat";

async function addXPDrop() {
  const propId =
    "0x389e5bd52432d7a431abeb7d539ddba811250f838b721674f4754aeb1164bc2b";

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
