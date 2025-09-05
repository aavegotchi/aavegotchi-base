import { LeaderboardAavegotchi, LeaderboardType, FoundSet } from "../types";
import request from "graphql-request";

import { wearableSetArrays } from "./wearableSets";
import { baseGraphUrl } from "./query/queryAavegotchis";

export function calculateCurrentKinship(
  subgraphKinship: string | number | undefined,
  lastInteracted: string | number | undefined,
  blockTimestamp: number
): string {
  // If no kinship or lastInteracted data, return the original value or "0"
  if (!subgraphKinship || !lastInteracted) {
    return subgraphKinship?.toString() || "0";
  }

  const kinshipValue = Number(subgraphKinship);
  const lastInteractedTimestamp = Number(lastInteracted);

  // If kinship is already 0, no further decay possible
  if (kinshipValue <= 0) {
    return "0";
  }

  const now = blockTimestamp; //|| Math.floor(Date.now() / 1000); // Current time in seconds
  const timeElapsed = now - lastInteractedTimestamp;

  // Each full 24-hour period (86400 seconds) reduces kinship by 1
  const daysPassed = Math.floor(timeElapsed / 86400);

  // Calculate current kinship (cannot go below 0)
  const currentKinship = Math.max(0, kinshipValue - daysPassed);

  return currentKinship.toString();
}

export function calculateRarityScore(traitArray: number[]) {
  const energy: number = returnRarity(traitArray[0]);
  const aggressiveness: number = returnRarity(traitArray[1]);
  const spookiness: number = returnRarity(traitArray[2]);
  const brainSize: number = returnRarity(traitArray[3]);
  const eyeShape: number = returnRarity(traitArray[4]);
  const eyeColor: number = returnRarity(traitArray[5]);
  return energy + aggressiveness + spookiness + brainSize + eyeShape + eyeColor;
}

function returnRarity(number: number) {
  if (number < 50) return 100 - number;
  else return number + 1;
}
function _distanceFrom50(trait: number) {
  return Math.abs(50 - trait);
}

export function _aavegotchiNumericTraits(aavegotchi: LeaderboardAavegotchi) {
  const val = aavegotchi.withSetsNumericTraits?.reduce(
    (total: number, val: number) => {
      return total + val;
    }
  );

  if (val === 0) return aavegotchi.modifiedNumericTraits;
  if (aavegotchi.withSetsNumericTraits) return aavegotchi.withSetsNumericTraits;
  else return aavegotchi.modifiedNumericTraits;
}

export function stripGotchis(ids: LeaderboardAavegotchi[]) {
  return ids.map((gotchi: LeaderboardAavegotchi) => gotchi.id);
}

export function confirmCorrectness(
  subgraphData: string[],
  localData: string[]
) {
  let j = 0;

  if (subgraphData.length !== localData.length) {
    console.log("length mismatch, exiting");
  }
  for (let i = 0; i < subgraphData.length; i++) {
    // console.log("subgraph vs local:", subgraphData[i], localData[i]);

    if (subgraphData[i] === localData[i]) {
      j++;
    } else {
      console.log("mismatch in position:", i, subgraphData[i], localData[i]);
    }
  }

  return j;
}

export interface SacrificedGotchi {
  id: string;
}

export async function fetchSacrificedGotchis(): Promise<SacrificedGotchi[]> {
  const maxResults = 5000;
  const batchSize = 1000;
  const batches = Math.ceil(maxResults / batchSize);

  const queries = [];
  for (let i = 0; i < batches; i++) {
    queries.push(`
      batch${i}: aavegotchis(
        first: ${batchSize},
        skip: ${i * batchSize},
        where: {owner: "0x0000000000000000000000000000000000000000"}
      ) {
        id
      }
    `);
  }

  const query = `
    {
      ${queries.join("\n")}
    }
  `;

  const response: Record<string, SacrificedGotchi[]> = await request(
    baseGraphUrl,
    query
  );
  return Object.values(response).flat();
}

export function leaderboardQuery(blockNumber: string): string {
  const aavegotchi = `
    id
    name
    baseRarityScore
    modifiedRarityScore
    withSetsRarityScore
    numericTraits
    modifiedNumericTraits
    withSetsNumericTraits
    stakedAmount
    equippedWearables
    kinship
    equippedSetID
    equippedSetName
    experience
    level
    collateral
    hauntId
    lastInteracted
    owner {
        id
    }`;
  const reqs: string[] = [];
  const max_runs = 25_000 / 1000; // 25_000 gotchis atm

  console.log("block number:", blockNumber);

  for (let i = 0; i < max_runs; i++) {
    reqs.push(`first${
      i * 1000
    }:aavegotchis(block:{number: ${blockNumber}} first:1000, orderBy: gotchiId, where: {
        gotchiId_gte: ${i * 1000}, gotchiId_lt: ${
      (i + 1) * 1000
    } , baseRarityScore_gt: 0
      }) {
        ${aavegotchi}
      }`);
  }

  return `{
    ${reqs.join("")}
  }`;
}

export const findSets = (equipped: number[]) => {
  //todo: add all sets
  const setData = wearableSetArrays;
  const foundSets: Array<FoundSet> = [];

  const getEquipmentIds = (acc: Array<number>, value: number) => {
    if (Number(value) > 0) {
      acc.push(Number(value));
    }
    return acc;
  };

  const equippedIds = equipped?.reduce(getEquipmentIds, []);

  for (const wearableSet of setData) {
    const setWearableIds = wearableSet.wearableIds.reduce(getEquipmentIds, []);
    if (
      setWearableIds.every((wearableId) =>
        equippedIds?.includes(wearableId)
      ) /*&& setWearableIds.length > numWearableIds*/
    ) {
      const setFound = {
        name: wearableSet.name,
        wearableIds: setWearableIds,
        traitsBonuses: wearableSet.traitsBonuses.map((v) => Number(v)),
        allowedCollaterals: wearableSet.allowedCollaterals.map((v) =>
          Number(v)
        ),
      };

      foundSets.push(setFound);
    }
  }

  foundSets.sort((a, b) => {
    return b.traitsBonuses[0] - a.traitsBonuses[0];
  });

  foundSets.sort((a, b) => b.wearableIds.length - a.wearableIds.length);

  return foundSets;
};

const findRightGotchiBonuses = (gotchi: any) => {
  if (!gotchi) return;
  // Shallow clone the gotchi to prevent mutating the original object's top-level properties
  const newGotchi = { ...gotchi };

  // Deep clone arrays to prevent mutating the original object's array properties
  newGotchi.equippedWearables = [...gotchi.equippedWearables];
  newGotchi.modifiedNumericTraits = [...gotchi.modifiedNumericTraits];

  const foundSets = findSets(newGotchi.equippedWearables);

  if (foundSets.length > 0) {
    const bestSet = foundSets[0];
    const setTraitBonuses: number[] = bestSet.traitsBonuses;
    const brsBonus = setTraitBonuses[0];

    // Deep clone the numeric traits to modify them without affecting the original
    const withSetsNumericTraits = [...newGotchi.modifiedNumericTraits];

    const beforeSetBonus = calculateRarityScore(
      newGotchi.modifiedNumericTraits
    );

    setTraitBonuses.slice(1).forEach((trait, index) => {
      withSetsNumericTraits[index] += trait;
    });

    const afterSetBonus = calculateRarityScore(withSetsNumericTraits);

    const bonusDifference = afterSetBonus - beforeSetBonus;

    newGotchi.withSetsNumericTraits = withSetsNumericTraits;

    newGotchi.withSetsRarityScore = (
      Number(newGotchi.modifiedRarityScore) +
      bonusDifference +
      brsBonus
    ).toString();
    newGotchi.equippedSetName = bestSet.name; // Set the name after calculating traits
  } else {
    newGotchi.withSetsNumericTraits = newGotchi.modifiedNumericTraits;
    newGotchi.withSetsRarityScore = newGotchi.modifiedRarityScore;
  }
  return newGotchi;
};

export async function fetchAndSortLeaderboard(
  category: "withSetsRarityScore" | "kinship" | "experience",
  blockNumber: string,
  tieBreakerIndex: number,
  blockTimestamp: number
) {
  let eachFinalResult: LeaderboardAavegotchi[] = [];
  const query = leaderboardQuery(blockNumber);

  const queryResponse: LeaderboardAavegotchi[] = await request(
    baseGraphUrl,
    query
  );

  let leaderboardResults: LeaderboardAavegotchi[] = Object.values(
    queryResponse
  ).flat(1) as LeaderboardAavegotchi[];

  // Add in set bonuses
  eachFinalResult = leaderboardResults.map((val) =>
    findRightGotchiBonuses(val)
  );

  // // Update kinship values to reflect current decay
  // eachFinalResult = eachFinalResult.map((gotchi) => ({
  //   ...gotchi,
  //   kinship: calculateCurrentKinship(gotchi.kinship, gotchi.lastInteracted),
  // }));

  function _sortByBRS(a: LeaderboardAavegotchi, b: LeaderboardAavegotchi) {
    if (a.withSetsRarityScore == b.withSetsRarityScore) {
      const aCurrentKinship = Number(
        calculateCurrentKinship(a.kinship, a.lastInteracted, blockTimestamp)
      );
      const bCurrentKinship = Number(
        calculateCurrentKinship(b.kinship, b.lastInteracted, blockTimestamp)
      );
      return bCurrentKinship - aCurrentKinship;
    }
    return Number(b.withSetsRarityScore) - Number(a.withSetsRarityScore);
  }

  function _sortByKinship(a: LeaderboardAavegotchi, b: LeaderboardAavegotchi) {
    const aCurrentKinship = Number(
      calculateCurrentKinship(a.kinship, a.lastInteracted, blockTimestamp)
    );
    const bCurrentKinship = Number(
      calculateCurrentKinship(b.kinship, b.lastInteracted, blockTimestamp)
    );

    if (aCurrentKinship === bCurrentKinship) {
      //Kinship and XP are the same
      if (a.experience === b.experience) {
        return (
          _distanceFrom50(
            Number(_aavegotchiNumericTraits(b)[tieBreakerIndex])
          ) -
          _distanceFrom50(Number(_aavegotchiNumericTraits(a)[tieBreakerIndex]))
        );
      } else return Number(b.experience) - Number(a.experience);
    }
    return bCurrentKinship - aCurrentKinship;
  }

  function _sortByExperience(
    a: LeaderboardAavegotchi,
    b: LeaderboardAavegotchi
  ) {
    if (a.experience === b.experience) {
      if (
        _distanceFrom50(_aavegotchiNumericTraits(a)[tieBreakerIndex]) ===
        _distanceFrom50(_aavegotchiNumericTraits(b)[tieBreakerIndex])
      ) {
        const aCurrentKinship = Number(
          calculateCurrentKinship(a.kinship, a.lastInteracted, blockTimestamp)
        );
        const bCurrentKinship = Number(
          calculateCurrentKinship(b.kinship, b.lastInteracted, blockTimestamp)
        );
        return bCurrentKinship - aCurrentKinship;
      } else {
        //Kinship and XP are the same
        return (
          _distanceFrom50(
            Number(_aavegotchiNumericTraits(b)[tieBreakerIndex])
          ) -
          _distanceFrom50(Number(_aavegotchiNumericTraits(a)[tieBreakerIndex]))
        );
      }
    } else return Number(b.experience) - Number(a.experience);
  }

  const sortingOptions: {
    [k in LeaderboardType]: (
      a: LeaderboardAavegotchi,
      b: LeaderboardAavegotchi
    ) => number;
  } = {
    withSetsRarityScore: _sortByBRS,
    kinship: _sortByKinship,
    experience: _sortByExperience,
  };

  console.log("category:", category);
  let sortedData = eachFinalResult.sort(sortingOptions[`${category}`]);

  sortedData = [...new Set(sortedData)];

  // console.log("final sorted 1:", sortedData);

  return sortedData.slice(0, 7500);
}
