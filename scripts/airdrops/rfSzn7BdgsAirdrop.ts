import { baseRelayerAddress, rankIds } from "../helperFunctions";

import { dataArgs as dataArgs1 } from "../../data/airdrops/rarityfarming/szn7/rnd1";
import { dataArgs as dataArgs2 } from "../../data/airdrops/rarityfarming/szn7/rnd2";
import { dataArgs as dataArgs3 } from "../../data/airdrops/rarityfarming/szn7/rnd3";
import { dataArgs as dataArgs4 } from "../../data/airdrops/rarityfarming/szn7/rnd4";
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
    "Aavegotchi-RF-SZN7-Trophy-1ST-PLACE-RARITY", //443
    "Aavegotchi-RF-SZN7-Trophy-1ST-PLACE-KINSHIP", //444
    "Aavegotchi-RF-SZN7-Trophy-1ST-PLACE-XP", //445
    "Aavegotchi-RF-SZN7-Trophy-2ND-PLACE-RARITY", //446
    "Aavegotchi-RF-SZN7-Trophy-2ND-PLACE-KINSHIP", //447
    "Aavegotchi-RF-SZN7-Trophy-2ND-PLACE-XP", //448
    "Aavegotchi-RF-SZN7-Trophy-3RD-PLACE-RARITY", //449
    "Aavegotchi-RF-SZN7-Trophy-3RD-PLACE-KINSHIP", //450
    "Aavegotchi-RF-SZN7-Trophy-3RD-PLACE-XP", //451
    "Aavegotchi-RF-SZN7-Baadge-TOP-RAANKED-PLAAYER", //452
    "Aavegotchi-RF-SZN7-Baadge-TOP-10-RARITY", //453
    "Aavegotchi-RF-SZN7-Baadge-TOP-10-KINSHIP", //454
    "Aavegotchi-RF-SZN7-Baadge-TOP-10-XP", //455
    "Aavegotchi-RF-SZN7-Baadge-TOP-100-RARITY", //456
    "Aavegotchi-RF-SZN7-Baadge-TOP-100-KINSHIP", //457
    "Aavegotchi-RF-SZN7-Baadge-TOP-100-XP", //458
  ];

  const baadgeIds = baadges.map((_, index) => 443 + index);

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

  let tieBreaker = await getGotchisForASeason("7", "matic");
  const [rarityBreaker, kinshipBreaker, xpBreaker] = tieBreaker;
  const rarityRFSzn7 = (await rankIds(rarityArray, rarityBreaker)).map((x) =>
    Number(x)
  );
  const xpRFSzn7 = (await rankIds(xpArray, xpBreaker)).map((x) => Number(x));
  const kinshipRFSzn7 = (await rankIds(kinshipArray, kinshipBreaker)).map((x) =>
    Number(x)
  );

  //airdrop all baadges except raanked
  await airdropBaadges(itemTypes, [rarityRFSzn7, kinshipRFSzn7, xpRFSzn7]);

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
