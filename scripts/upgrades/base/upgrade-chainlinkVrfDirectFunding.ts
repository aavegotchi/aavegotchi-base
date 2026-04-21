import { BigNumber } from "ethers";
import { ethers, network, run } from "hardhat";

import {
  chainlinkDirectFundingVarsForNetwork,
  varsForNetwork,
} from "../../../helpers/constants";
import { diamondOwner, getLedgerSigner } from "../../helperFunctions";
import { getLegacyVrfPreflightSummary } from "./chainlinkVrfPreflight";
import {
  ChainlinkVrfDirectFundingAdapter,
  ForgeVRFFacet,
  VrfFacet,
} from "../../../typechain";
import {
  convertFacetAndSelectorsToString,
  DeployUpgradeTaskArgs,
  FacetsAndAddSelectors,
} from "../../../tasks/deployUpgrade";

const TESTING_NETWORKS = ["hardhat", "localhost"];

async function getOwnerSigner(owner: string) {
  const testing = TESTING_NETWORKS.includes(network.name);

  if (testing) {
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [owner],
    });
    await network.provider.request({
      method: "hardhat_setBalance",
      params: [owner, "0x100000000000000000000000"],
    });
    return ethers.getSigner(owner);
  }

  const signer = await getLedgerSigner(ethers);
  const signerAddress = await signer.getAddress();
  if (signerAddress.toLowerCase() !== owner.toLowerCase()) {
    throw new Error(
      `Ledger signer ${signerAddress} is not the diamond owner ${owner}. Use the correct Ledger account before running this upgrade.`
    );
  }

  return signer;
}

function getFundAmount(estimatedPrice: BigNumber) {
  const configuredAmount = process.env.CHAINLINK_VRF_FUND_AMOUNT_WEI;
  if (configuredAmount) {
    return BigNumber.from(configuredAmount);
  }

  const configuredRequestCount = process.env.CHAINLINK_VRF_FUND_REQUEST_COUNT;
  if (configuredRequestCount) {
    return estimatedPrice.mul(Number(configuredRequestCount));
  }

  if (TESTING_NETWORKS.includes(network.name)) {
    return estimatedPrice.mul(25);
  }

  throw new Error(
    "Set CHAINLINK_VRF_FUND_AMOUNT_WEI or CHAINLINK_VRF_FUND_REQUEST_COUNT before running on a live network."
  );
}

async function upgradeVrfFacets(
  aavegotchiDiamond: string,
  forgeDiamond: string,
  owner: string
) {
  const aavegotchiFacets: FacetsAndAddSelectors[] = [
    {
      facetName: "VrfFacet",
      addSelectors: [
        "function rerollPendingPortal(uint256 _tokenId) external returns (uint256 requestId_)",
      ],
      removeSelectors: [],
    },
  ];
  const forgeFacets: FacetsAndAddSelectors[] = [
    {
      facetName: "ForgeVRFFacet",
      addSelectors: [
        "function rerollPendingForgeRequest(uint256 requestId) external returns (uint256 newRequestId)",
      ],
      removeSelectors: [],
    },
  ];

  const aavegotchiArgs: DeployUpgradeTaskArgs = {
    diamondOwner: owner,
    diamondAddress: aavegotchiDiamond,
    facetsAndAddSelectors: convertFacetAndSelectorsToString(aavegotchiFacets),
    useLedger: true,
    useRelayer: false,
    useMultisig: false,
    initAddress: ethers.constants.AddressZero,
    initCalldata: "0x",
  };

  const forgeArgs: DeployUpgradeTaskArgs = {
    diamondOwner: owner,
    diamondAddress: forgeDiamond,
    facetsAndAddSelectors: convertFacetAndSelectorsToString(forgeFacets),
    useLedger: true,
    useRelayer: false,
    useMultisig: false,
    initAddress: ethers.constants.AddressZero,
    initCalldata: "0x",
  };

  console.log("Upgrading VrfFacet with rerollPendingPortal");
  await run("deployUpgrade", aavegotchiArgs);

  console.log("Upgrading ForgeVRFFacet with rerollPendingForgeRequest");
  await run("deployUpgrade", forgeArgs);
}

export async function upgradeChainlinkVrfDirectFunding() {
  console.log("Deploying Chainlink direct-funding VRF adapter");

  if (TESTING_NETWORKS.includes(network.name)) {
    await network.provider.request({
      method: "evm_mine",
      params: [],
    });
  }

  const c = await varsForNetwork(ethers);
  const vrfConfig = await chainlinkDirectFundingVarsForNetwork(ethers);
  if (!vrfConfig) {
    throw new Error("Missing Chainlink direct-funding config for this network");
  }
  if (!c.aavegotchiDiamond || !c.forgeDiamond) {
    throw new Error("Missing diamond addresses for this network");
  }

  const approvedConsumers = [c.aavegotchiDiamond, c.forgeDiamond];
  const aavegotchiOwner = await diamondOwner(c.aavegotchiDiamond, ethers);
  const forgeOwner = await diamondOwner(c.forgeDiamond, ethers);

  if (aavegotchiOwner.toLowerCase() !== forgeOwner.toLowerCase()) {
    throw new Error(
      `Diamond owners differ: aavegotchi=${aavegotchiOwner} forge=${forgeOwner}`
    );
  }

  const ownerSigner = await getOwnerSigner(aavegotchiOwner);
  const ownerAddress = await ownerSigner.getAddress();

  console.log("owner:", ownerAddress);
  console.log("aavegotchiDiamond:", c.aavegotchiDiamond);
  console.log("forgeDiamond:", c.forgeDiamond);
  console.log("wrapper:", vrfConfig.wrapper);
  console.log("callbackGasLimit:", vrfConfig.callbackGasLimit);
  console.log("requestConfirmations:", vrfConfig.requestConfirmations);

  const preflight = await getLegacyVrfPreflightSummary(ethers.provider, {
    aavegotchiDiamond: c.aavegotchiDiamond,
    forgeDiamond: c.forgeDiamond,
  });
  console.log("preflight latestBlock:", preflight.latestBlock);
  console.log("preflight pendingPortalCount:", preflight.pendingPortalCount);
  console.log("preflight pendingForgeCount:", preflight.pendingForgeCount);
  console.log(
    "preflight readyToClaimForgeCount:",
    preflight.readyToClaimForgeCount
  );
  if (preflight.pendingPortalCount > 0 || preflight.pendingForgeCount > 0) {
    console.log(
      "Legacy PoP requests remain pending. Complete the cutover, then reroll the stranded requests with the new facet functions."
    );
  }

  await upgradeVrfFacets(c.aavegotchiDiamond, c.forgeDiamond, aavegotchiOwner);

  const Adapter = await ethers.getContractFactory(
    "ChainlinkVrfDirectFundingAdapter",
    ownerSigner
  );
  const adapter = (await Adapter.deploy(
    vrfConfig.wrapper,
    vrfConfig.callbackGasLimit,
    vrfConfig.requestConfirmations,
    approvedConsumers
  )) as ChainlinkVrfDirectFundingAdapter;
  await adapter.deployed();

  console.log("adapter:", adapter.address);

  const estimatedPrice = await adapter.estimateRequestPriceNative();
  const fundAmount = getFundAmount(estimatedPrice);
  console.log("estimatedRequestPriceWei:", estimatedPrice.toString());
  console.log("fundAmountWei:", fundAmount.toString());

  if (fundAmount.gt(0)) {
    const fundTx = await ownerSigner.sendTransaction({
      to: adapter.address,
      value: fundAmount,
    });
    console.log("fund tx:", fundTx.hash);
    await fundTx.wait();
  }

  const aavegotchiVrfFacet = (await ethers.getContractAt(
    "VrfFacet",
    c.aavegotchiDiamond,
    ownerSigner
  )) as VrfFacet;
  const forgeVrfFacet = (await ethers.getContractAt(
    "ForgeVRFFacet",
    c.forgeDiamond,
    ownerSigner
  )) as ForgeVRFFacet;

  console.log(
    "old aavegotchi vrfSystem:",
    await aavegotchiVrfFacet.vrfSystem()
  );
  console.log("old forge vrfSystem:", await forgeVrfFacet.vrfSystem());

  const aavegotchiTx = await aavegotchiVrfFacet.setVRFSystem(adapter.address);
  console.log("aavegotchi setVRFSystem tx:", aavegotchiTx.hash);
  await aavegotchiTx.wait();

  const forgeTx = await forgeVrfFacet.setVRFSystem(adapter.address);
  console.log("forge setVRFSystem tx:", forgeTx.hash);
  await forgeTx.wait();

  const currentAavegotchiVrfSystem = await aavegotchiVrfFacet.vrfSystem();
  const currentForgeVrfSystem = await forgeVrfFacet.vrfSystem();
  const approvedAavegotchi = await adapter.approvedConsumers(
    c.aavegotchiDiamond
  );
  const approvedForge = await adapter.approvedConsumers(c.forgeDiamond);
  const adapterBalance = await ethers.provider.getBalance(adapter.address);

  if (
    currentAavegotchiVrfSystem.toLowerCase() !== adapter.address.toLowerCase()
  ) {
    throw new Error("Aavegotchi diamond VRFSystem was not updated");
  }
  if (currentForgeVrfSystem.toLowerCase() !== adapter.address.toLowerCase()) {
    throw new Error("Forge diamond VRFSystem was not updated");
  }
  if (!approvedAavegotchi || !approvedForge) {
    throw new Error("Adapter consumer approvals were not set correctly");
  }
  if (adapterBalance.lt(fundAmount)) {
    throw new Error("Adapter funding did not arrive");
  }

  console.log("new aavegotchi vrfSystem:", currentAavegotchiVrfSystem);
  console.log("new forge vrfSystem:", currentForgeVrfSystem);
  console.log("adapter balance:", adapterBalance.toString());
  console.log("pending portal tokenIds:", preflight.pendingPortalTokenIds);
  console.log("pending forge requests:", preflight.pendingForge);
  console.log("Chainlink direct-funding VRF upgrade verified");
}

if (require.main === module) {
  upgradeChainlinkVrfDirectFunding()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
