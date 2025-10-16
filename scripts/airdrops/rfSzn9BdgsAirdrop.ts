import { baseRelayerAddress, rankIds } from "../helperFunctions";

import { dataArgs as dataArgs1 } from "../../data/airdrops/rarityfarming/szn9/rnd1";
import { dataArgs as dataArgs2 } from "../../data/airdrops/rarityfarming/szn9/rnd2";
import { dataArgs as dataArgs3 } from "../../data/airdrops/rarityfarming/szn9/rnd3";
import { dataArgs as dataArgs4 } from "../../data/airdrops/rarityfarming/szn9/rnd4";
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
    "Aavegotchi-RF-SZN9-Trophy-1ST-PLACE-RARITY", //475
    "Aavegotchi-RF-SZN9-Trophy-1ST-PLACE-KINSHIP", //476
    "Aavegotchi-RF-SZN9-Trophy-1ST-PLACE-XP", //477
    "Aavegotchi-RF-SZN9-Trophy-2ND-PLACE-RARITY", //478
    "Aavegotchi-RF-SZN9-Trophy-2ND-PLACE-KINSHIP", //479
    "Aavegotchi-RF-SZN9-Trophy-2ND-PLACE-XP", //480
    "Aavegotchi-RF-SZN9-Trophy-3RD-PLACE-RARITY", //481
    "Aavegotchi-RF-SZN9-Trophy-3RD-PLACE-KINSHIP", //482
    "Aavegotchi-RF-SZN9-Trophy-3RD-PLACE-XP", //483
    "Aavegotchi-RF-SZN9-Baadge-TOP-RAANKED-PLAAYER", //484
    "Aavegotchi-RF-SZN9-Baadge-TOP-10-RARITY", //485
    "Aavegotchi-RF-SZN9-Baadge-TOP-10-KINSHIP", //486
    "Aavegotchi-RF-SZN9-Baadge-TOP-10-XP", //487
    "Aavegotchi-RF-SZN9-Baadge-TOP-100-RARITY", //488
    "Aavegotchi-RF-SZN9-Baadge-TOP-100-KINSHIP", //489
    "Aavegotchi-RF-SZN9-Baadge-TOP-100-XP", //490
  ];

  const baadgeIds = baadges.map((_, index) => 475 + index);

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
    "9"
  );
  const rarityRFSzn9 = (await rankIds(rarityArray, rarityBreaker)).map((x) =>
    Number(x)
  );
  const xpRFSzn9 = (await rankIds(xpArray, xpBreaker)).map((x) => Number(x));
  const kinshipRFSzn9 = (await rankIds(kinshipArray, kinshipBreaker)).map((x) =>
    Number(x)
  );

  //airdrop all baadges except raanked
  await airdropBaadges(itemTypes, [rarityRFSzn9, kinshipRFSzn9, xpRFSzn9]);

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
