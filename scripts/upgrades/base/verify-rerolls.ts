import { BigNumber, Contract, ethers as ethersPkg } from "ethers";
import { getRetryingStaticProvider } from "../../helperFunctions";

const BASE_RPC_URL = process.env.BASE_RPC_URL;
if (!BASE_RPC_URL) {
  throw new Error("BASE_RPC_URL is required");
}

const provider = getRetryingStaticProvider(BASE_RPC_URL, {
  chainId: 8453,
  name: "base",
});

const AAVEGOTCHI_DIAMOND = "0xA99c4B08201F2913Db8D28e71d020c4298F29dBF";
const FORGE_DIAMOND = "0x50aF2d63b839aA32b4166FD1Cb247129b715186C";
const ADAPTER =
  process.env.CHAINLINK_VRF_ADAPTER_BASE ||
  "0x259C780C506B73314b12f5C757F4D7aF925F731a";

const PORTAL_REROLL_TX =
  "0xdb1111abb58f9c1d9325efa314f0fa5d140210dd58c0e0d17d3ec9d86d058b83";
const FORGE_REROLL_TX =
  "0x8cea0963be081aa956910e9393def519d48abece44860bf4421f6cd2b44f26dd";

const PORTAL_TOKEN_ID = "783";
const PORTAL_REQUEST_ID =
  "15138650140729996609015286153793326677340404679391073001494771152310453392019";

const FORGE_REROLLS = [
  {
    user: "0xa98e714577ad2b41efbcb5f79c3cd663bc806905",
    oldRequestId: "89869",
    newRequestId:
      "21751760088145448665182168900514315933762764516371985176921799461609958856562",
  },
  {
    user: "0x9fe6d7d5e9c9e3bff91149fbf731b618cbce3375",
    oldRequestId: "89877",
    newRequestId:
      "13093870931260153678382472906583548438858047653694228737160834473284330406978",
  },
  {
    user: "0xa9465d03ba38726277b3e478ac98aa063a0c8d0a",
    oldRequestId: "89871",
    newRequestId:
      "31028879779721416571770203005776561235345444676208218286060187722351657031186",
  },
  {
    user: "0xc4cb6cb969e8b4e309ab98e4da51b77887afad96",
    oldRequestId: "89872",
    newRequestId:
      "24715483070427644996556983911614714823777729116440069147663754354257567734603",
  },
];

const adapterIface = new ethersPkg.utils.Interface([
  "event RandomNumberRequested(address indexed callbackContract,uint256 indexed requestId,uint256 indexed traceId,uint256 paid)",
  "function getRequestStatus(uint256 requestId) view returns (tuple(address callbackContract,uint256 traceId,uint256 paid,uint256 randomNumber,bool fulfilled,bool delivered))",
]);

const aavegotchiIface = new ethersPkg.utils.Interface([
  "function vrfSystem() view returns (address)",
  "function getBaseRandomNumber(uint256 _tokenId) view returns (uint256)",
]);

const forgeIface = new ethersPkg.utils.Interface([
  "function vrfSystem() view returns (address)",
  "function getRequestInfoByRequestId(uint256 requestId) view returns (tuple(address user,uint256 requestId,uint8 status,uint256 randomNumber,uint256[] geodeTokenIds,uint256[] amountPerToken))",
]);

function normalizeAddress(address: string) {
  return address.toLowerCase();
}

function assertCondition(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function parseRequestLogs(
  receipt: ethersPkg.providers.TransactionReceipt,
  expectedCount: number
) {
  const requests = [];
  for (const log of receipt.logs) {
    if (normalizeAddress(log.address) !== normalizeAddress(ADAPTER)) continue;

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
    } catch {}
  }

  assertCondition(
    requests.length === expectedCount,
    `Expected ${expectedCount} RandomNumberRequested logs in receipt ${receipt.transactionHash}, found ${requests.length}`
  );

  return requests;
}

async function main() {
  const aavegotchi = new Contract(AAVEGOTCHI_DIAMOND, aavegotchiIface, provider);
  const forge = new Contract(FORGE_DIAMOND, forgeIface, provider);
  const adapter = new Contract(ADAPTER, adapterIface, provider);

  const [
    latestBlock,
    aavegotchiVrfSystem,
    forgeVrfSystem,
    portalReceipt,
    forgeReceipt,
    portalRandomNumber,
  ] = await Promise.all([
    provider.getBlockNumber(),
    aavegotchi.vrfSystem(),
    forge.vrfSystem(),
    provider.getTransactionReceipt(PORTAL_REROLL_TX),
    provider.getTransactionReceipt(FORGE_REROLL_TX),
    aavegotchi.getBaseRandomNumber(PORTAL_TOKEN_ID),
  ]);

  assertCondition(
    normalizeAddress(aavegotchiVrfSystem) === normalizeAddress(ADAPTER),
    `Aavegotchi diamond vrfSystem mismatch: ${aavegotchiVrfSystem}`
  );
  assertCondition(
    normalizeAddress(forgeVrfSystem) === normalizeAddress(ADAPTER),
    `Forge diamond vrfSystem mismatch: ${forgeVrfSystem}`
  );
  assertCondition(
    portalReceipt && portalReceipt.status === 1,
    `Portal reroll tx did not succeed: ${PORTAL_REROLL_TX}`
  );
  assertCondition(
    forgeReceipt && forgeReceipt.status === 1,
    `Forge reroll tx did not succeed: ${FORGE_REROLL_TX}`
  );

  const portalRequests = parseRequestLogs(portalReceipt, 1);
  const forgeRequests = parseRequestLogs(forgeReceipt, FORGE_REROLLS.length);

  assertCondition(
    portalRequests[0].traceId === PORTAL_TOKEN_ID,
    `Portal reroll traceId mismatch: ${portalRequests[0].traceId}`
  );
  assertCondition(
    portalRequests[0].requestId === PORTAL_REQUEST_ID,
    `Portal reroll requestId mismatch: ${portalRequests[0].requestId}`
  );

  const forgeRequestsByTraceId = new Map(
    forgeRequests.map((request) => [request.traceId, request])
  );

  const forgeStatuses = [];
  for (const reroll of FORGE_REROLLS) {
    const requestLog = forgeRequestsByTraceId.get(reroll.oldRequestId);
    assertCondition(
      Boolean(requestLog),
      `Missing forge reroll request log for ${reroll.oldRequestId}`
    );
    assertCondition(
      requestLog.requestId === reroll.newRequestId,
      `Forge reroll requestId mismatch for ${reroll.oldRequestId}: ${requestLog.requestId}`
    );

    const [adapterStatus, forgeStatus] = await Promise.all([
      adapter.getRequestStatus(reroll.newRequestId),
      forge.getRequestInfoByRequestId(reroll.newRequestId),
    ]);

    forgeStatuses.push({
      user: reroll.user,
      oldRequestId: reroll.oldRequestId,
      newRequestId: reroll.newRequestId,
      adapter: {
        callbackContract: adapterStatus.callbackContract,
        traceId: adapterStatus.traceId.toString(),
        paid: adapterStatus.paid.toString(),
        randomNumber: adapterStatus.randomNumber.toString(),
        fulfilled: adapterStatus.fulfilled,
        delivered: adapterStatus.delivered,
      },
      forge: {
        status: Number(forgeStatus.status),
        randomNumber: forgeStatus.randomNumber.toString(),
      },
    });
  }

  const portalAdapterStatus = await adapter.getRequestStatus(PORTAL_REQUEST_ID);

  const output = {
    checkedAtUtc: new Date().toISOString(),
    latestBlock,
    adapter: ADAPTER,
    diamonds: {
      aavegotchiVrfSystem,
      forgeVrfSystem,
    },
    portal: {
      tokenId: PORTAL_TOKEN_ID,
      rerollTx: {
        hash: PORTAL_REROLL_TX,
        blockNumber: portalReceipt.blockNumber,
        gasUsed: portalReceipt.gasUsed.toString(),
      },
      requestId: PORTAL_REQUEST_ID,
      baseRandomNumber: portalRandomNumber.toString(),
      adapter: {
        callbackContract: portalAdapterStatus.callbackContract,
        traceId: portalAdapterStatus.traceId.toString(),
        paid: portalAdapterStatus.paid.toString(),
        randomNumber: portalAdapterStatus.randomNumber.toString(),
        fulfilled: portalAdapterStatus.fulfilled,
        delivered: portalAdapterStatus.delivered,
      },
    },
    forge: {
      rerollTx: {
        hash: FORGE_REROLL_TX,
        blockNumber: forgeReceipt.blockNumber,
        gasUsed: forgeReceipt.gasUsed.toString(),
      },
      requests: forgeStatuses,
    },
  };

  console.log(JSON.stringify(output, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
