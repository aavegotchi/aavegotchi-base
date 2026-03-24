import { ethers } from "ethers";

const GEODE_MIN = ethers.BigNumber.from("1000000002");
const GEODE_MAX = ethers.BigNumber.from("1000000007");

export interface LegacyVrfAddresses {
  aavegotchiDiamond: string;
  forgeDiamond: string;
}

export interface LegacyVrfPreflightSummary {
  latestBlock: number;
  pendingPortalCount: number;
  pendingPortalTokenIds: string[];
  pendingForgeCount: number;
  pendingForge: { user: string; requestId: string }[];
  readyToClaimForgeCount: number;
  readyToClaimForge: { user: string; requestId: string }[];
}

async function findDeployBlock(
  provider: ethers.providers.Provider,
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
  provider: ethers.providers.Provider,
  filterBase: ethers.providers.Filter,
  fromBlock: number,
  toBlock: number,
  step = 1_000_000
) {
  const logs = [];
  for (let start = fromBlock; start <= toBlock; start += step) {
    const end = Math.min(start + step - 1, toBlock);
    const chunk = await provider.getLogs({
      ...filterBase,
      fromBlock: start,
      toBlock: end,
    });
    logs.push(...chunk);
  }
  return logs;
}

export async function getLegacyVrfPreflightSummary(
  provider: ethers.providers.Provider,
  addresses: LegacyVrfAddresses
): Promise<LegacyVrfPreflightSummary> {
  const latest = await provider.getBlockNumber();
  const aavegotchiDeployBlock = await findDeployBlock(
    provider,
    addresses.aavegotchiDiamond,
    latest
  );
  const forgeDeployBlock = await findDeployBlock(
    provider,
    addresses.forgeDiamond,
    latest
  );

  const portalInterface = new ethers.utils.Interface([
    "event OpenPortals(uint256[] _tokenIds)",
    "event PortalOpened(uint256 indexed tokenId)",
  ]);
  const openTopic = portalInterface.getEventTopic("OpenPortals");
  const openedTopic = portalInterface.getEventTopic("PortalOpened");

  const openLogs = await getLogsByChunks(
    provider,
    { address: addresses.aavegotchiDiamond, topics: [openTopic] },
    aavegotchiDeployBlock,
    latest
  );
  const openedLogs = await getLogsByChunks(
    provider,
    { address: addresses.aavegotchiDiamond, topics: [openedTopic] },
    aavegotchiDeployBlock,
    latest
  );

  const pendingPortals = new Set<string>();
  for (const log of openLogs) {
    const parsed = portalInterface.parseLog(log);
    for (const tokenId of parsed.args._tokenIds) {
      pendingPortals.add(tokenId.toString());
    }
  }
  for (const log of openedLogs) {
    const parsed = portalInterface.parseLog(log);
    pendingPortals.delete(parsed.args.tokenId.toString());
  }

  const forgeInterface = new ethers.utils.Interface([
    "event TransferSingle(address indexed operator,address indexed from,address indexed to,uint256 id,uint256 value)",
    "event TransferBatch(address indexed operator,address indexed from,address indexed to,uint256[] ids,uint256[] values)",
    "function getRequestInfo(address user) view returns (tuple(address user,uint256 requestId,uint8 status,uint256 randomNumber,uint256[] geodeTokenIds,uint256[] amountPerToken))",
  ]);
  const transferSingleTopic = forgeInterface.getEventTopic("TransferSingle");
  const transferBatchTopic = forgeInterface.getEventTopic("TransferBatch");
  const toTopic = ethers.utils.hexZeroPad(
    addresses.forgeDiamond.toLowerCase(),
    32
  );

  const singleLogs = await getLogsByChunks(
    provider,
    {
      address: addresses.forgeDiamond,
      topics: [transferSingleTopic, null, null, toTopic],
    },
    forgeDeployBlock,
    latest
  );
  const batchLogs = await getLogsByChunks(
    provider,
    {
      address: addresses.forgeDiamond,
      topics: [transferBatchTopic, null, null, toTopic],
    },
    forgeDeployBlock,
    latest
  );

  const forgeUsers = new Set<string>();
  for (const log of singleLogs) {
    const parsed = forgeInterface.parseLog(log);
    if (parsed.args.id.gte(GEODE_MIN) && parsed.args.id.lte(GEODE_MAX)) {
      forgeUsers.add(parsed.args.from.toLowerCase());
    }
  }
  for (const log of batchLogs) {
    const parsed = forgeInterface.parseLog(log);
    const hasGeode = parsed.args.ids.some(
      (id) => id.gte(GEODE_MIN) && id.lte(GEODE_MAX)
    );
    if (hasGeode) {
      forgeUsers.add(parsed.args.from.toLowerCase());
    }
  }

  const forgeContract = new ethers.Contract(
    addresses.forgeDiamond,
    forgeInterface,
    provider
  );
  const pendingForge: { user: string; requestId: string }[] = [];
  const readyToClaimForge: { user: string; requestId: string }[] = [];
  for (const user of forgeUsers) {
    try {
      const info = await forgeContract.getRequestInfo(user);
      const status = Number(info.status);
      if (status === 0) {
        pendingForge.push({ user, requestId: info.requestId.toString() });
      } else if (status === 1) {
        readyToClaimForge.push({
          user,
          requestId: info.requestId.toString(),
        });
      }
    } catch (err) {}
  }

  return {
    latestBlock: latest,
    pendingPortalCount: pendingPortals.size,
    pendingPortalTokenIds: Array.from(pendingPortals),
    pendingForgeCount: pendingForge.length,
    pendingForge,
    readyToClaimForgeCount: readyToClaimForge.length,
    readyToClaimForge,
  };
}

export async function assertNoPendingLegacyVrfRequests(
  provider: ethers.providers.Provider,
  addresses: LegacyVrfAddresses
) {
  const summary = await getLegacyVrfPreflightSummary(provider, addresses);

  if (summary.pendingPortalCount > 0 || summary.pendingForgeCount > 0) {
    throw new Error(
      `Legacy PoP VRF requests are still pending. pendingPortals=${summary.pendingPortalCount} pendingForge=${summary.pendingForgeCount}`
    );
  }

  return summary;
}
