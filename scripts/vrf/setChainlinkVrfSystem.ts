import { ethers } from "hardhat";

import { varsForNetwork } from "../../helpers/constants";

async function main() {
  const adapter = process.env.CHAINLINK_VRF_ADAPTER;
  if (!adapter) {
    throw new Error("CHAINLINK_VRF_ADAPTER is required");
  }

  const addresses = await varsForNetwork(ethers);
  const signer = (await ethers.getSigners())[0];

  const aavegotchiVrfFacet = await ethers.getContractAt(
    "VrfFacet",
    addresses.aavegotchiDiamond!,
    signer
  );
  const forgeVrfFacet = await ethers.getContractAt(
    "ForgeVRFFacet",
    addresses.forgeDiamond!,
    signer
  );

  const aavegotchiTx = await aavegotchiVrfFacet.setVRFSystem(adapter);
  console.log("aavegotchi setVRFSystem tx:", aavegotchiTx.hash);
  await aavegotchiTx.wait();

  const forgeTx = await forgeVrfFacet.setVRFSystem(adapter);
  console.log("forge setVRFSystem tx:", forgeTx.hash);
  await forgeTx.wait();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
