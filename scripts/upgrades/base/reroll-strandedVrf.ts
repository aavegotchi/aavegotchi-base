import { ContractReceipt } from "@ethersproject/contracts";
import { ethers, network } from "hardhat";

import { varsByChainId } from "../../../helpers/constants";
import { getLedgerSigner } from "../../helperFunctions";
import {
  ChainlinkVrfDirectFundingAdapter__factory,
  ForgeVRFFacet,
  VrfFacet,
} from "../../../typechain";
import { HARDCODED_BASE_STRANDED_VRF_REQUESTS } from "./strandedVrfRequests";

const TESTING_NETWORKS = ["hardhat", "localhost"];
const BASE_DIAMOND_OWNER = "0x01F010a5e001fe9d6940758EA5e8c777885E351e";
const REROLL_PORTALS_GAS_LIMIT = 1_000_000;
const REROLL_FORGE_GAS_LIMIT = 5_000_000;

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

export async function rerollStrandedVrfRequests() {
  if (TESTING_NETWORKS.includes(network.name)) {
    await network.provider.request({
      method: "evm_mine",
      params: [],
    });
  }

  const c = varsByChainId(8453);
  if (!c.aavegotchiDiamond || !c.forgeDiamond) {
    throw new Error("Missing diamond addresses for this network");
  }

  const ownerSigner = await getOwnerSigner(BASE_DIAMOND_OWNER);
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
  const configuredAdapter = process.env.CHAINLINK_VRF_ADAPTER_BASE;
  if (!configuredAdapter) {
    throw new Error("CHAINLINK_VRF_ADAPTER_BASE is required");
  }

  const summary = HARDCODED_BASE_STRANDED_VRF_REQUESTS;
  const filtered = summary;

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
      filtered.pendingPortalTokenIds,
      { gasLimit: REROLL_PORTALS_GAS_LIMIT }
    );
    const receipt = await tx.wait();
    const requests = parseAdapterRequests(receipt, configuredAdapter);
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
    const tx = await forgeVrfFacet.rerollPendingForgeRequests(requestIds, {
      gasLimit: REROLL_FORGE_GAS_LIMIT,
    });
    const receipt = await tx.wait();
    const requests = parseAdapterRequests(receipt, configuredAdapter);
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
