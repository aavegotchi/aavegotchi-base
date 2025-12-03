import { baseRelayerAddress, rankIds } from "../helperFunctions";

import { dataArgs as dataArgs1 } from "../../data/airdrops/rarityfarming/szn8/rnd1";
import { dataArgs as dataArgs2 } from "../../data/airdrops/rarityfarming/szn8/rnd2";
import { dataArgs as dataArgs3 } from "../../data/airdrops/rarityfarming/szn8/rnd3";
import { dataArgs as dataArgs4 } from "../../data/airdrops/rarityfarming/szn8/rnd4";
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
    "Aavegotchi-RF-SZN8-Trophy-1ST-PLACE-RARITY", //459
    "Aavegotchi-RF-SZN8-Trophy-1ST-PLACE-KINSHIP", //460
    "Aavegotchi-RF-SZN8-Trophy-1ST-PLACE-XP", //461
    "Aavegotchi-RF-SZN8-Trophy-2ND-PLACE-RARITY", //462
    "Aavegotchi-RF-SZN8-Trophy-2ND-PLACE-KINSHIP", //463
    "Aavegotchi-RF-SZN8-Trophy-2ND-PLACE-XP", //464
    "Aavegotchi-RF-SZN8-Trophy-3RD-PLACE-RARITY", //465
    "Aavegotchi-RF-SZN8-Trophy-3RD-PLACE-KINSHIP", //466
    "Aavegotchi-RF-SZN8-Trophy-3RD-PLACE-XP", //467
    "Aavegotchi-RF-SZN8-Baadge-TOP-RAANKED-PLAAYER", //468
    "Aavegotchi-RF-SZN8-Baadge-TOP-10-RARITY", //469
    "Aavegotchi-RF-SZN8-Baadge-TOP-10-KINSHIP", //470
    "Aavegotchi-RF-SZN8-Baadge-TOP-10-XP", //471
    "Aavegotchi-RF-SZN8-Baadge-TOP-100-RARITY", //472
    "Aavegotchi-RF-SZN8-Baadge-TOP-100-KINSHIP", //473
    "Aavegotchi-RF-SZN8-Baadge-TOP-100-XP", //474
  ];

  const baadgeIds = baadges.map((_, index) => 459 + index);

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
    "8",
    "matic"
  );
  const rarityRFSzn8 = (await rankIds(rarityArray, rarityBreaker)).map((x) =>
    Number(x)
  );
  const xpRFSzn8 = (await rankIds(xpArray, xpBreaker)).map((x) => Number(x));
  const kinshipRFSzn8 = (await rankIds(kinshipArray, kinshipBreaker)).map((x) =>
    Number(x)
  );

  //airdrop all baadges except raanked
  await airdropBaadges(itemTypes, [rarityRFSzn8, kinshipRFSzn8, xpRFSzn8]);

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
