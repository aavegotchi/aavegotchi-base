import { baseRelayerAddress, rankIds } from "../../scripts/helperFunctions";

import { dataArgs as dataArgs1 } from "../../data/airdrops/rarityfarming/szn6/rnd1";
import { dataArgs as dataArgs2 } from "../../data/airdrops/rarityfarming/szn6/rnd2";
import { dataArgs as dataArgs3 } from "../../data/airdrops/rarityfarming/szn6/rnd3";
import { dataArgs as dataArgs4 } from "../../data/airdrops/rarityfarming/szn6/rnd4";
import { getGotchisForASeason } from "../getAavegotchisForRF";
import {
  airdropBaadges,
  airdropRaankedBaadges,
  assertBaadgeQuantities,
} from "../../scripts/airdrops/baadgeHelpers";
import { run } from "hardhat";

import { itemTypes as allItemTypes } from "../../data/itemTypes/itemTypes";
import { ItemTypeInputNew, toItemTypeInputNew } from "../itemTypeHelpers";

export async function main() {
  const baadges: string[] = [
    "Aavegotchi-RF-SZN6-Trophy-1ST-PLACE-RARITY", //427
    "Aavegotchi-RF-SZN6-Trophy-1ST-PLACE-KINSHIP", //428
    "Aavegotchi-RF-SZN6-Trophy-1ST-PLACE-XP", //429
    "Aavegotchi-RF-SZN6-Trophy-2ND-PLACE-RARITY", //430
    "Aavegotchi-RF-SZN6-Trophy-2ND-PLACE-KINSHIP", //431
    "Aavegotchi-RF-SZN6-Trophy-2ND-PLACE-XP", //432
    "Aavegotchi-RF-SZN6-Trophy-3RD-PLACE-RARITY", //433
    "Aavegotchi-RF-SZN6-Trophy-3RD-PLACE-KINSHIP", //434
    "Aavegotchi-RF-SZN6-Trophy-3RD-PLACE-XP", //435
    "Aavegotchi-RF-SZN6-Baadge-TOP-RAANKED-PLAAYER", //436
    "Aavegotchi-RF-SZN6-Baadge-TOP-10-RARITY", //437
    "Aavegotchi-RF-SZN6-Baadge-TOP-10-KINSHIP", //438
    "Aavegotchi-RF-SZN6-Baadge-TOP-10-XP", //439
    "Aavegotchi-RF-SZN6-Baadge-TOP-100-RARITY", //440
    "Aavegotchi-RF-SZN6-Baadge-TOP-100-KINSHIP", //441
    "Aavegotchi-RF-SZN6-Baadge-TOP-100-XP", //442
  ];

  const baadgeIds = baadges.map((_, index) => 427 + index);

  const itemTypes: ItemTypeInputNew[] = baadgeIds.map((id) => {
    const itemType = allItemTypes.find((type) => Number(type.svgId) === id);

    if (!itemType) {
      throw new Error(`Item type with svgId ${id} not found in itemTypes data`);
    }

    return toItemTypeInputNew(itemType);
  });

  const rarityArray = [
    dataArgs1.rarityGotchis,
    dataArgs2.rarityGotchis,
    dataArgs3.rarityGotchis,
    dataArgs4.rarityGotchis,
  ];
  const kinshipArray = [
    dataArgs1.kinshipGotchis,
    dataArgs2.kinshipGotchis,
    dataArgs3.kinshipGotchis,
    dataArgs4.kinshipGotchis,
  ];
  const xpArray = [
    dataArgs1.xpGotchis,
    dataArgs2.xpGotchis,
    dataArgs3.xpGotchis,
    dataArgs4.xpGotchis,
  ];

  //do raanked baadges amount check
  const totalPlayers = await assertBaadgeQuantities(
    itemTypes,
    rarityArray,
    kinshipArray,
    xpArray
  );

  await run("addAndMintBaseWearables", {
    itemIds: baadgeIds.join(","),
    recipient: baseRelayerAddress,
  });

  //Airdrop

  let tieBreaker = await getGotchisForASeason("6");
  const [rarityBreaker, kinshipBreaker, xpBreaker] = tieBreaker;
  const rarityRFSzn6 = rankIds(rarityArray, rarityBreaker).map((x) =>
    Number(x)
  );
  const xpRFSzn6 = await rankIds(xpArray, xpBreaker).map((x) => Number(x));
  const kinshipRFSzn6 = await rankIds(kinshipArray, kinshipBreaker).map((x) =>
    Number(x)
  );

  //airdrop all baadges except raanked
  await airdropBaadges(itemTypes, [rarityRFSzn6, kinshipRFSzn6, xpRFSzn6]);

  //airdrop ranked
  //TO-DO: Uncomment when running on live network
  // await airdropRaankedBaadges(itemTypes, totalPlayers);
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))

    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
