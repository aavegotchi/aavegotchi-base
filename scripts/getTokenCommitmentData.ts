import { ethers } from "hardhat";

const tokenCommitmentData = require("./tokenCommitmentData.json");

export type TokenCommitment = {
  depositId: string;
  grantor: { id: string };
  tokenId: string;
};

export type TokenCommitmentData = {
  data: { tokenCommitments: TokenCommitment[] };
};

export type GrantorToTokenIds = Record<string, number[]>;

export function buildGrantorToTokenIdsMap(): GrantorToTokenIds {
  const data: TokenCommitmentData = tokenCommitmentData as TokenCommitmentData;
  const grantorToTokenIds: GrantorToTokenIds = {};

  for (const commitment of data.data.tokenCommitments) {
    const grantorChecksummed = ethers.utils.getAddress(commitment.grantor.id);
    const tokenIdNumber = Number(commitment.tokenId);

    if (!grantorToTokenIds[grantorChecksummed]) {
      grantorToTokenIds[grantorChecksummed] = [];
    }

    grantorToTokenIds[grantorChecksummed].push(tokenIdNumber);
  }

  // Dedupe tokenIds per grantor while preserving order
  for (const grantor of Object.keys(grantorToTokenIds)) {
    const seen = new Set<number>();
    const uniqueIds: number[] = [];
    for (const id of grantorToTokenIds[grantor]) {
      if (!seen.has(id)) {
        seen.add(id);
        uniqueIds.push(id);
      }
    }
    grantorToTokenIds[grantor] = uniqueIds;
  }

  console.log(grantorToTokenIds);
  return grantorToTokenIds;
}

export type GrantorBatches = Record<
  string,
  { ids: number[]; values: number[] }
>;

export function buildGrantorBatches(map: GrantorToTokenIds): GrantorBatches {
  const batches: GrantorBatches = {};
  for (const [grantor, ids] of Object.entries(map)) {
    batches[grantor] = { ids, values: Array(ids.length).fill(1) };
  }
  return batches;
}

export type BatchSafeTransferFromArgs = {
  tos: string[];
  ids: number[][];
  values: number[][];
  data: string[];
};

export function buildBatchSafeTransferFromArgs(
  map: GrantorToTokenIds
): BatchSafeTransferFromArgs {
  const tos = Object.keys(map);
  const ids = tos.map((to) => map[to]);
  const values = ids.map((arr) => Array(arr.length).fill(1));
  const data = tos.map(() => "0x");
  return { tos, ids, values, data };
}

// All-in-one: takes the raw JSON (TokenCommitmentData) and returns full batch args
export function buildBatchSafeTransferFromArgsFromJson(
  json: TokenCommitmentData
): BatchSafeTransferFromArgs {
  const grantorToTokenIds: GrantorToTokenIds = {};

  for (const commitment of json.data.tokenCommitments) {
    const grantorChecksummed = ethers.utils.getAddress(commitment.grantor.id);
    const tokenIdNumber = Number(commitment.tokenId);

    if (!grantorToTokenIds[grantorChecksummed]) {
      grantorToTokenIds[grantorChecksummed] = [];
    }

    grantorToTokenIds[grantorChecksummed].push(tokenIdNumber);
  }

  for (const grantor of Object.keys(grantorToTokenIds)) {
    const seen = new Set<number>();
    const uniqueIds: number[] = [];
    for (const id of grantorToTokenIds[grantor]) {
      if (!seen.has(id)) {
        seen.add(id);
        uniqueIds.push(id);
      }
    }
    grantorToTokenIds[grantor] = uniqueIds;
  }

  return buildBatchSafeTransferFromArgs(grantorToTokenIds);
}

if (require.main === module) {
  const map = buildGrantorToTokenIdsMap();
  // Print grantor -> tokenIds[] map for quick verification
  for (const [grantor, ids] of Object.entries(map)) {
    console.log(`${grantor} => [${ids.join(", ")}]`);
  }

  //print a summary of all the unique token Ids and their combined amounts
  const tokenIdToAmount = new Map<number, number>();
  for (const [grantor, ids] of Object.entries(map)) {
    for (const id of ids) {
      tokenIdToAmount.set(id, (tokenIdToAmount.get(id) || 0) + 1);
    }
  }
  console.log("tokenIdToAmount:", tokenIdToAmount);
  const payload = buildBatchSafeTransferFromArgs(map);
  console.log("batchSafeTransferFrom payload:");
  console.log(JSON.stringify(payload, null, 2));
}
