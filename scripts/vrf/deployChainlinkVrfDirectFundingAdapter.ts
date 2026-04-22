import { ethers } from "hardhat";

import {
  chainlinkDirectFundingVarsForNetwork,
  varsForNetwork,
} from "../../helpers/constants";

async function main() {
  const network = await ethers.provider.getNetwork();
  const config = await chainlinkDirectFundingVarsForNetwork(ethers);
  const addresses = await varsForNetwork(ethers);

  if (!config) {
    throw new Error(
      `No Chainlink direct-funding config for chain ${network.chainId}`
    );
  }

  const approvedConsumers = [
    addresses.aavegotchiDiamond,
    addresses.forgeDiamond,
  ].filter((address): address is string => Boolean(address));

  if (approvedConsumers.length === 0) {
    throw new Error("No approved consumers configured for this network");
  }

  const Adapter = await ethers.getContractFactory(
    "ChainlinkVrfDirectFundingAdapter"
  );
  const adapter = await Adapter.deploy(
    config.wrapper,
    config.callbackGasLimit,
    config.requestConfirmations,
    approvedConsumers
  );
  await adapter.deployed();

  console.log("ChainlinkVrfDirectFundingAdapter deployed");
  console.log("network:", network.chainId);
  console.log("adapter:", adapter.address);
  console.log("wrapper:", config.wrapper);
  console.log("callbackGasLimit:", config.callbackGasLimit);
  console.log("requestConfirmations:", config.requestConfirmations);
  console.log("approvedConsumers:", approvedConsumers.join(","));

  const estimatedPrice = await adapter.estimateRequestPriceNative();
  console.log("estimatedNativePriceWei:", estimatedPrice.toString());
  console.log(
    "fund the adapter with native gas token before switching VRFSystem"
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
