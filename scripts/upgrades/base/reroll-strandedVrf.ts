import { ContractReceipt } from "@ethersproject/contracts";
import { ethers, network } from "hardhat";

import {
  varsForNetwork,
  vrfSystemAddressForNetwork,
} from "../../../helpers/constants";
import { diamondOwner, getLedgerSigner } from "../../helperFunctions";
import { getLegacyVrfPreflightSummary } from "./chainlinkVrfPreflight";
import {
  ChainlinkVrfDirectFundingAdapter__factory,
  ForgeVRFFacet,
  VrfFacet,
} from "../../../typechain";
import { type LegacyVrfPreflightSummary } from "./chainlinkVrfPreflight";

const TESTING_NETWORKS = ["hardhat", "localhost"];

export interface AdapterRequestMarker {
  callbackContract: string;
  requestId: string;
  traceId: string;
  paid: string;
}

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
      `Ledger signer ${signerAddress} is not the diamond owner ${owner}. Use the correct Ledger account before running this script.`
    );
  }

  return signer;
}

function parseAdapterRequests(receipt: ContractReceipt, adapterAddress: string) {
  const adapterIface =
    ChainlinkVrfDirectFundingAdapter__factory.createInterface();
  const requests = [];
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== adapterAddress.toLowerCase()) {
      continue;
    }

    try {
      const parsed = adapterIface.parseLog(log);
      if (parsed.name === "RandomNumberRequested") {
        requests.push({
          callbackContract: parsed.args.callbackContract.toString(),
          requestId: parsed.args.requestId.toString(),
          traceId: parsed.args.traceId.toString(),
          paid: parsed.args.paid.toString(),
        });
      }
    } catch (err) {}
  }

  if (requests.length === 0) {
    throw new Error("Could not find RandomNumberRequested event in receipt");
  }

  return requests;
}

async function findDeployBlock(
  provider: typeof ethers.provider,
  address: string,
  latest: number
) {
  let lo = 0;
  let hi = latest;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const code = await provider.getCode(address, mid);
    if (code && code !== "0x") {
      hi = mid;
    } else {
      lo = mid + 1;
    }
  }
  return lo;
}

async function getLogsByChunks(
  fromBlock: number,
  toBlock: number,
  address: string,
  topic: string,
  step = 1_000_000
) {
  const logs = [];
  for (let start = fromBlock; start <= toBlock; start += step) {
    const end = Math.min(start + step - 1, toBlock);
    const chunk = await ethers.provider.getLogs({
      address,
      topics: [topic],
      fromBlock: start,
      toBlock: end,
    });
    logs.push(...chunk);
  }
  return logs;
}

async function getAdapterRequestMarkers(
  adapterAddress: string
): Promise<AdapterRequestMarker[]> {
  const latest = await ethers.provider.getBlockNumber();
  const deployBlock = await findDeployBlock(
    ethers.provider,
    adapterAddress,
    latest
  );
  const adapterIface =
    ChainlinkVrfDirectFundingAdapter__factory.createInterface();
  const requestTopic = adapterIface.getEventTopic("RandomNumberRequested");
  const logs = await getLogsByChunks(
    deployBlock,
    latest,
    adapterAddress,
    requestTopic
  );

  return logs.map((log) => {
    const parsed = adapterIface.parseLog(log);
    return {
      callbackContract: parsed.args.callbackContract.toString(),
      requestId: parsed.args.requestId.toString(),
      traceId: parsed.args.traceId.toString(),
      paid: parsed.args.paid.toString(),
    };
  });
}

export function filterAlreadyRerolledRequests(
  summary: LegacyVrfPreflightSummary,
  aavegotchiDiamond: string,
  forgeDiamond: string,
  adapterRequests: AdapterRequestMarker[]
) {
  const portalRequests = adapterRequests.filter(
    (request) =>
      request.callbackContract.toLowerCase() === aavegotchiDiamond.toLowerCase()
  );
  const forgeRequests = adapterRequests.filter(
    (request) =>
      request.callbackContract.toLowerCase() === forgeDiamond.toLowerCase()
  );

  const rerolledPortalTokenIds = new Set(
    portalRequests.map((request) => request.traceId)
  );
  const rerolledForgeRequestIds = new Set(
    forgeRequests.flatMap((request) =>
      request.traceId !== "0"
        ? [request.traceId, request.requestId]
        : [request.requestId]
    )
  );

  const pendingPortalTokenIds = summary.pendingPortalTokenIds.filter(
    (tokenId) => !rerolledPortalTokenIds.has(tokenId)
  );
  const pendingForge = summary.pendingForge.filter(
    (pending) => !rerolledForgeRequestIds.has(pending.requestId)
  );

  return {
    ...summary,
    pendingPortalCount: pendingPortalTokenIds.length,
    pendingPortalTokenIds,
    pendingForgeCount: pendingForge.length,
    pendingForge,
  };
}

export async function rerollStrandedVrfRequests() {
  if (TESTING_NETWORKS.includes(network.name)) {
    await network.provider.request({
      method: "evm_mine",
      params: [],
    });
  }

  const c = await varsForNetwork(ethers);
  if (!c.aavegotchiDiamond || !c.forgeDiamond) {
    throw new Error("Missing diamond addresses for this network");
  }

  const aavegotchiOwner = await diamondOwner(c.aavegotchiDiamond, ethers);
  const forgeOwner = await diamondOwner(c.forgeDiamond, ethers);
  if (aavegotchiOwner.toLowerCase() !== forgeOwner.toLowerCase()) {
    throw new Error(
      `Diamond owners differ: aavegotchi=${aavegotchiOwner} forge=${forgeOwner}`
    );
  }

  const ownerSigner = await getOwnerSigner(aavegotchiOwner);
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

  const currentAavegotchiVrfSystem = await aavegotchiVrfFacet.vrfSystem();
  const currentForgeVrfSystem = await forgeVrfFacet.vrfSystem();
  if (
    currentAavegotchiVrfSystem.toLowerCase() !==
    currentForgeVrfSystem.toLowerCase()
  ) {
    throw new Error("Diamonds point to different VRF systems");
  }

  let configuredAdapter: string | undefined;
  try {
    configuredAdapter = await vrfSystemAddressForNetwork(ethers);
  } catch (err) {}

  if (
    configuredAdapter &&
    configuredAdapter.toLowerCase() !== currentAavegotchiVrfSystem.toLowerCase()
  ) {
    throw new Error(
      `Configured adapter ${configuredAdapter} does not match on-chain VRFSystem ${currentAavegotchiVrfSystem}`
    );
  }

  const adapter = await ethers.getContractAt(
    "ChainlinkVrfDirectFundingAdapter",
    currentAavegotchiVrfSystem,
    ownerSigner
  );
  const approvedAavegotchi = await adapter.approvedConsumers(
    c.aavegotchiDiamond
  );
  const approvedForge = await adapter.approvedConsumers(c.forgeDiamond);
  if (!approvedAavegotchi || !approvedForge) {
    throw new Error("Current VRF system is not configured for both diamonds");
  }

  const summary = await getLegacyVrfPreflightSummary(ethers.provider, {
    aavegotchiDiamond: c.aavegotchiDiamond,
    forgeDiamond: c.forgeDiamond,
  });
  const adapterRequests = await getAdapterRequestMarkers(adapter.address);
  const filtered = filterAlreadyRerolledRequests(
    summary,
    c.aavegotchiDiamond,
    c.forgeDiamond,
    adapterRequests
  );

  console.log("latestBlock:", filtered.latestBlock);
  console.log("pendingPortalCount:", filtered.pendingPortalTokenIds.length);
  console.log("pendingForgeCount:", filtered.pendingForge.length);

  if (
    filtered.pendingPortalTokenIds.length === 0 &&
    filtered.pendingForge.length === 0
  ) {
    console.log("No stranded VRF requests found");
    return;
  }

  if (filtered.pendingPortalTokenIds.length > 0) {
    const tx = await aavegotchiVrfFacet.rerollPendingPortals(
      filtered.pendingPortalTokenIds
    );
    const receipt = await tx.wait();
    const requests = parseAdapterRequests(receipt, adapter.address);
    const requestsByTraceId = new Map(
      requests.map((request) => [request.traceId, request])
    );

    for (const tokenId of filtered.pendingPortalTokenIds) {
      const request = requestsByTraceId.get(tokenId);
      if (!request) {
        throw new Error(`Missing adapter request for rerolled portal ${tokenId}`);
      }

      console.log(
        `Rerolled portal ${tokenId} -> adapter request ${request.requestId} (traceId ${request.traceId}) tx ${tx.hash}`
      );
    }
  }

  if (filtered.pendingForge.length > 0) {
    const requestIds = filtered.pendingForge.map((pending) => pending.requestId);
    const tx = await forgeVrfFacet.rerollPendingForgeRequests(requestIds);
    const receipt = await tx.wait();
    const requests = parseAdapterRequests(receipt, adapter.address);
    const requestsByTraceId = new Map(
      requests.map((request) => [request.traceId, request])
    );

    for (const pending of filtered.pendingForge) {
      const request = requestsByTraceId.get(pending.requestId);
      if (!request) {
        throw new Error(
          `Missing adapter request for rerolled forge request ${pending.requestId}`
        );
      }

      console.log(
        `Rerolled forge request ${pending.requestId} for ${pending.user} -> adapter request ${request.requestId} (traceId ${request.traceId}) tx ${tx.hash}`
      );
    }
  }
}

if (require.main === module) {
  rerollStrandedVrfRequests()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
