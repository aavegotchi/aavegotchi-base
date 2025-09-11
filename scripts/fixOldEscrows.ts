import { ethers, network } from "hardhat";
import { upgrade } from "./upgrades/base/upgrade-fixAllOldEscrows";
import * as https from "https";
import {
  baseRelayerAddress,
  getRelayerSigner,
  impersonate,
} from "./helperFunctions";
import { varsForNetwork } from "../helpers/constants";

async function graphqlRequest<T>(
  url: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const payload = JSON.stringify({ query, variables });
  return new Promise<T>((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(payload).toString(),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            if (json.errors) {
              return reject(new Error(JSON.stringify(json.errors)));
            }
            resolve(json.data as T);
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

async function fetchLendingListingIdsAndGotchiIds(): Promise<{
  listingIds: number[];
  gotchiIds: number[];
}> {
  const subgraphUrl = process.env.SUBGRAPH_CORE_MATIC;
  if (!subgraphUrl) throw new Error("SUBGRAPH_CORE_MATIC is not set in .env");

  const query = `
    query AllLendings {
      gotchiLendings(first: 1000 orderBy: timeCreated) {
        gotchiTokenId
        id
      }
    }
  `;

  type Resp = { gotchiLendings: { id: string; gotchiTokenId: string }[] };
  const data = await graphqlRequest<Resp>(subgraphUrl, query);
  const listingIds = data.gotchiLendings.map((l) => Number(l.id));
  const gotchiIds = data.gotchiLendings.map((l) => Number(l.gotchiTokenId));
  return { listingIds, gotchiIds };
}

async function fetchEscrowMapForGotchisAtBlock(
  ids: number[],
  blockNumber: number
): Promise<Map<string, string>> {
  const subgraphUrl = process.env.SUBGRAPH_CORE_MATIC;
  if (!subgraphUrl) throw new Error("SUBGRAPH_CORE_MATIC is not set in .env");

  // Using variables for ids; inlining block number to avoid potential Block_height var issues
  const query = `
    query Escrows($ids: [ID!]) {
      aavegotchis(block: { number: ${blockNumber} }, first: 1000, where: { id_in: $ids }) {
        id
        escrow
      }
    }
  `;

  type Resp = { aavegotchis: { id: string; escrow: string }[] };
  const variables = { ids: ids.map((id) => id.toString()) };
  const data = await graphqlRequest<Resp>(subgraphUrl, query, variables);
  const map = new Map<string, string>();
  for (const r of data.aavegotchis) map.set(r.id, r.escrow);
  return map;
}

async function main() {
  //upgrade first
  await upgrade();
  // Fetch all historical lending listingIds and gotchiTokenIds from the subgraph
  const { listingIds, gotchiIds } = await fetchLendingListingIdsAndGotchiIds();
  console.log(`Total lendings from subgraph: ${listingIds.length}`);

  // Fetch escrows for all unique gotchis at the target block via subgraph
  const blockTag = 35056015; // block before all escrows were redeployed
  const uniqueGotchiIds = Array.from(new Set(gotchiIds));
  const idToEscrow = await fetchEscrowMapForGotchisAtBlock(
    uniqueGotchiIds,
    blockTag
  );

  // Build aligned escrows array corresponding to each listingId
  const zero = "0x0000000000000000000000000000000000000000";
  const escrows: string[] = gotchiIds.map(
    (id) => idToEscrow.get(id.toString()) || zero
  );

  console.log(
    `Fetched ${idToEscrow.size} unique gotchi escrows from subgraph at block ${blockTag}`
  );

  //@ts-ignore
  const signer = await getRelayerSigner(hre);
  const c = await varsForNetwork(ethers);
  let escrowFacet = await ethers.getContractAt(
    "EscrowFacet",
    c.aavegotchiDiamond!
  );

  const testing = ["hardhat", "localhost"].includes(network.name);
  if (testing) {
    escrowFacet = await impersonate(
      baseRelayerAddress,
      escrowFacet,
      ethers,
      network
    );
  }
  //attempt to correcct all lendings in batches of 20
  const revenueTokens = [c.fud!, c.fomo!, c.alpha!, c.kek!];
  const batchSize = 20;

  for (let i = 0; i < listingIds.length; i += batchSize) {
    const batch = listingIds.slice(i, i + batchSize);
    const escrowsToUse = escrows.slice(i, i + batchSize);
    const tx = await escrowFacet.fixOldLendingsAndSettleAlchemica(
      batch,
      escrowsToUse,
      revenueTokens
    );
    const receipt = await tx.wait();
    console.log(
      `Fixed ${batch.length} lendings`,
      receipt.gasUsed.toString(),
      "gas"
    );
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
