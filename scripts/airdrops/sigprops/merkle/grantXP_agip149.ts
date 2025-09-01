import { run } from "hardhat";

async function addXPDrop() {
  const propId =
    "0xb9a713cf64939a3539844d7b16a94c900cbee3fd091c7f30087507cdef00e233";

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
