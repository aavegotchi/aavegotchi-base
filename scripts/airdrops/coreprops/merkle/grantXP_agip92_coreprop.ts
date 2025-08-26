import { run } from "hardhat";

async function addXPDrop() {
  const propId =
    "0x22577b713bc6a0b3670bd721af21c4649329ec1744652adc0ecb9f70dbbf6716";

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
