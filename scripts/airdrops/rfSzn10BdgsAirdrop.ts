import { baseRelayerAddress, rankIds } from "../helperFunctions";

import { dataArgs as dataArgs1 } from "../../data/airdrops/rarityfarming/szn10/rnd1";
import { dataArgs as dataArgs2 } from "../../data/airdrops/rarityfarming/szn10/rnd2";
import { dataArgs as dataArgs3 } from "../../data/airdrops/rarityfarming/szn10/rnd3";
import { dataArgs as dataArgs4 } from "../../data/airdrops/rarityfarming/szn10/rnd4";
import { getGotchisForASeason } from "../getAavegotchisForRF";
import {
  airdropBaadges,
  airdropRaankedBaadges,
  assertBaadgeQuantities,
} from "./baadgeHelpers";
import { run } from "hardhat";

import { itemTypes as allItemTypes } from "../../data/itemTypes/itemTypes";
import { ItemTypeInputNew, toItemTypeInputNew } from "../itemTypeHelpers";

export async function main() {
  const baadges: string[] = [
    "Aavegotchi-RF-SZN10-Trophy-1ST-PLACE-RARITY", //491
    "Aavegotchi-RF-SZN10-Trophy-1ST-PLACE-KINSHIP", //492
    "Aavegotchi-RF-SZN10-Trophy-1ST-PLACE-XP", //493
    "Aavegotchi-RF-SZN10-Trophy-2ND-PLACE-RARITY", //494
    "Aavegotchi-RF-SZN10-Trophy-2ND-PLACE-KINSHIP", //495
    "Aavegotchi-RF-SZN10-Trophy-2ND-PLACE-XP", //496
    "Aavegotchi-RF-SZN10-Trophy-3RD-PLACE-RARITY", //497
    "Aavegotchi-RF-SZN10-Trophy-3RD-PLACE-KINSHIP", //498
    "Aavegotchi-RF-SZN10-Trophy-3RD-PLACE-XP", //499
    "Aavegotchi-RF-SZN10-Baadge-TOP-RAANKED-PLAAYER", //500
    "Aavegotchi-RF-SZN10-Baadge-TOP-10-RARITY", //501
    "Aavegotchi-RF-SZN10-Baadge-TOP-10-KINSHIP", //502
    "Aavegotchi-RF-SZN10-Baadge-TOP-10-XP", //503
    "Aavegotchi-RF-SZN10-Baadge-TOP-100-RARITY", //504
    "Aavegotchi-RF-SZN10-Baadge-TOP-100-KINSHIP", //505
    "Aavegotchi-RF-SZN10-Baadge-TOP-100-XP", //506
  ];

  const baadgeIds = baadges.map((_, index) => 491 + index);

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

  const [rarityBreaker, kinshipBreaker, xpBreaker] = await getGotchisForASeason(
    "10"
  );
  const rarityRFSzn10 = (await rankIds(rarityArray, rarityBreaker)).map((x) =>
    Number(x)
  );
  const xpRFSzn10 = (await rankIds(xpArray, xpBreaker)).map((x) => Number(x));
  const kinshipRFSzn10 = (await rankIds(kinshipArray, kinshipBreaker)).map(
    (x) => Number(x)
  );

  //airdrop all baadges except raanked
  await airdropBaadges(itemTypes, [rarityRFSzn10, kinshipRFSzn10, xpRFSzn10]);

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
