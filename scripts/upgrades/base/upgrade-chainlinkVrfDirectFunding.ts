import { BigNumber } from "ethers";
import { ethers, network, run } from "hardhat";

import {
  chainlinkDirectFundingVars,
  varsByChainId,
} from "../../../helpers/constants";
import { getLedgerSigner } from "../../helperFunctions";
import { HARDCODED_BASE_STRANDED_VRF_REQUESTS } from "./strandedVrfRequests";
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
const INITIAL_ADAPTER_FUND_REQUEST_COUNT = 10;
const BASE_DIAMOND_OWNER = "0x01F010a5e001fe9d6940758EA5e8c777885E351e";
type UpgradePhase =
  | "all"
  | "aavegotchi-facet"
  | "forge-facet"
  | "cutover";

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

  const signer = await getLedgerSigner(ethers, network.name);
  const signerAddress = await signer.getAddress();
  if (signerAddress.toLowerCase() !== owner.toLowerCase()) {
    throw new Error(
      `Ledger signer ${signerAddress} is not the diamond owner ${owner}. Use the correct Ledger account before running this upgrade.`
    );
  }

  return signer;
}

function getFundAmount(estimatedPrice: BigNumber) {
  return estimatedPrice.mul(INITIAL_ADAPTER_FUND_REQUEST_COUNT);
}

async function upgradeAavegotchiVrfFacet(
  aavegotchiDiamond: string,
  owner: string
) {
  const aavegotchiFacets: FacetsAndAddSelectors[] = [
    {
      facetName: "VrfFacet",
      addSelectors: [
        "function rerollPendingPortals(uint256[] calldata _tokenIds) external returns (uint256[] memory requestIds_)",
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

  console.log("Upgrading VrfFacet with rerollPendingPortals");
  await run("deployUpgrade", aavegotchiArgs);
}

async function upgradeForgeVrfFacet(forgeDiamond: string, owner: string) {
  const forgeFacets: FacetsAndAddSelectors[] = [
    {
      facetName: "ForgeVRFFacet",
      addSelectors: [
        "function rerollPendingForgeRequests(uint256[] calldata requestIds) external returns (uint256[] memory newRequestIds)",
      ],
      removeSelectors: [],
    },
  ];

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

  console.log("Upgrading ForgeVRFFacet with rerollPendingForgeRequests");
  await run("deployUpgrade", forgeArgs);
}

export async function upgradeChainlinkVrfDirectFunding() {
  console.log("Deploying Chainlink direct-funding VRF adapter");
  const phase = (process.env.CHAINLINK_VRF_PHASE ||
    "all") as UpgradePhase;
  console.log("phase:", phase);

  if (TESTING_NETWORKS.includes(network.name)) {
    await network.provider.request({
      method: "evm_mine",
      params: [],
    });
  }

  const c = varsByChainId(8453);
  const vrfConfig = chainlinkDirectFundingVars[8453];
  if (!vrfConfig) {
    throw new Error("Missing Chainlink direct-funding config for this network");
  }
  if (!c.aavegotchiDiamond || !c.forgeDiamond) {
    throw new Error("Missing diamond addresses for this network");
  }

  const approvedConsumers = [c.aavegotchiDiamond, c.forgeDiamond];
  console.log("owner:", BASE_DIAMOND_OWNER);
  console.log("aavegotchiDiamond:", c.aavegotchiDiamond);
  console.log("forgeDiamond:", c.forgeDiamond);
  console.log("wrapper:", vrfConfig.wrapper);
  console.log("callbackGasLimit:", vrfConfig.callbackGasLimit);
  console.log("requestConfirmations:", vrfConfig.requestConfirmations);

  const preflight = HARDCODED_BASE_STRANDED_VRF_REQUESTS;
  console.log("preflight latestBlock:", preflight.latestBlock);
  console.log("preflight pendingPortalCount:", preflight.pendingPortalCount);
  console.log("preflight pendingForgeCount:", preflight.pendingForgeCount);
  console.log(
    "preflight readyToClaimForgeCount:",
    preflight.readyToClaimForgeCount
  );
  if (preflight.pendingPortalCount > 0 || preflight.pendingForgeCount > 0) {
    console.log(
      "Using hardcoded stranded PoP requests. Complete the cutover, then reroll the stranded requests with the new facet functions."
    );
  }

  if (phase === "aavegotchi-facet") {
    await upgradeAavegotchiVrfFacet(c.aavegotchiDiamond, BASE_DIAMOND_OWNER);
    console.log("Completed phase aavegotchi-facet");
    return;
  }

  if (phase === "forge-facet") {
    await upgradeForgeVrfFacet(c.forgeDiamond, BASE_DIAMOND_OWNER);
    console.log("Completed phase forge-facet");
    return;
  }

  if (phase === "all") {
    await upgradeAavegotchiVrfFacet(c.aavegotchiDiamond, BASE_DIAMOND_OWNER);
    await upgradeForgeVrfFacet(c.forgeDiamond, BASE_DIAMOND_OWNER);
  }

  if (phase !== "all" && phase !== "cutover") {
    throw new Error(`Unsupported phase ${phase}`);
  }

  const ownerSigner = await getOwnerSigner(BASE_DIAMOND_OWNER);

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
  const adapterBalance = await ownerSigner.provider!.getBalance(adapter.address);

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
