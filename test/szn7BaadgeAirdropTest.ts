import { ethers, network } from "hardhat";
//import { maticDiamondAddress } from "../scripts/helperFunctions";
import { AavegotchiFacet, ItemsFacet } from "../typechain";
import { Signer } from "@ethersproject/abstract-signer";
import { expect } from "chai";

//import { itemTypes } from "../scripts/addItemTypes/itemTypes/rfSzn7Bdgs";
import { dataArgs as dataArgs1 } from "../data/airdrops/rarityfarming/szn7/rnd1";
import { dataArgs as dataArgs2 } from "../data/airdrops/rarityfarming/szn7/rnd2";
import { dataArgs as dataArgs3 } from "../data/airdrops/rarityfarming/szn7/rnd3";
import { dataArgs as dataArgs4 } from "../data/airdrops/rarityfarming/szn7/rnd4";

import {
  baseRelayerAddress,
  impersonate,
  rankIds,
} from "../scripts/helperFunctions";
import { main } from "../scripts/airdrops/rfSzn7BdgsAirdrop";
import { main as mintSzn6Baadges } from "../scripts/airdrops/rfSzn7BdgsAirdrop";
import { getGotchisForASeason } from "../scripts/getAavegotchisForRF";
import { varsForNetwork } from "../helpers/constants";
import { ItemTypeInputNew } from "../scripts/itemTypeHelpers";
import { addAndMintBaseBackgroundsToPC } from "../scripts/taskScripts/addAndMintBaseBackgroundsToPC";

describe("Airdrop SZN7 Baadges", async function () {
  this.timeout(200000000);

  let itemsFacet: ItemsFacet,
    rarityRFSzn7: number[],
    kinshipRFSzn7: number[],
    xpRFSzn7: number[],
    itemTypes: ItemTypeInputNew[];

  before(async function () {
    //mint the pendng bakgrounds to sync
    //  await addAndMintBaseBackgroundsToPC();
    //add rarity farming baadges szn6
    //  await mintSzn6Baadges();
    const c = await varsForNetwork(ethers);

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

    itemsFacet = (await ethers.getContractAt(
      "contracts/Aavegotchi/facets/ItemsFacet.sol:ItemsFacet",
      c.aavegotchiDiamond!
    )) as ItemsFacet;

    itemsFacet = await impersonate(
      baseRelayerAddress,
      itemsFacet,
      ethers,
      network
    );

    //itemtypes for szn7 baadges
    itemTypes = await getItemTypesForSzn7Baadges();

    let tieBreaker = await getGotchisForASeason("7");
    const [rarityBreaker, kinshipBreaker, xpBreaker] = tieBreaker;

    rarityRFSzn7 = await rankIds(rarityArray, rarityBreaker).map((id) =>
      parseInt(id)
    );

    kinshipRFSzn7 = await rankIds(kinshipArray, kinshipBreaker).map((id) =>
      parseInt(id)
    );

    xpRFSzn7 = await rankIds(xpArray, xpBreaker).map((id) => parseInt(id));

    await main();
  });

  it.only("Should airdrop szn7 champion baadges", async function () {
    //rarity champ

    //log out the tokenId and svgId we are checking
    console.log("Checking rarity champ: ", rarityRFSzn7[0], itemTypes[0].svgId);
    console.log(
      "Checking kinship champ: ",
      kinshipRFSzn7[0],
      itemTypes[1].svgId
    );
    console.log("Checking xp champ: ", xpRFSzn7[0], itemTypes[2].svgId);

    expect(
      await exists(
        rarityRFSzn7[0].toString(),
        itemTypes[0].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);

    //kinship champ
    expect(
      await exists(
        kinshipRFSzn7[0].toString(),
        itemTypes[1].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);

    //xp champ
    expect(
      await exists(
        xpRFSzn7[0].toString(),
        itemTypes[2].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);
  });

  it.only("Should airdrop szn7 2nd and 3rd place baadges", async function () {
    //rarity 2nd

    expect(
      await exists(
        rarityRFSzn7[1].toString(),
        itemTypes[3].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);

    //kinship 2nd
    expect(
      await exists(
        kinshipRFSzn7[1].toString(),
        itemTypes[4].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);

    // //xp 2nd
    expect(
      await exists(
        xpRFSzn7[1].toString(),
        itemTypes[5].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);

    //rarity 3rd
    expect(
      await exists(
        rarityRFSzn7[2].toString(),
        itemTypes[6].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);

    //kinship 3rd
    expect(
      await exists(
        kinshipRFSzn7[2].toString(),
        itemTypes[7].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);

    //xp 3rd
    expect(
      await exists(
        xpRFSzn7[2].toString(),
        itemTypes[8].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);
  });

  it.only("Should airdrop szn7 top10 baadges", async function () {
    //rarity top 10

    expect(
      await exists(
        rarityRFSzn7[3].toString(),
        itemTypes[10].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);

    expect(
      await exists(
        rarityRFSzn7[9].toString(),
        itemTypes[10].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);

    //kinship top 10

    expect(
      await exists(
        kinshipRFSzn7[3].toString(),
        itemTypes[11].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);

    expect(
      await exists(
        kinshipRFSzn7[9].toString(),
        itemTypes[11].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);

    //XP top 10
    expect(
      await exists(
        xpRFSzn7[3].toString(),
        itemTypes[12].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);

    expect(
      await exists(
        xpRFSzn7[9].toString(),
        itemTypes[12].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);
  });

  it.only("Should airdrop szn7 top100 baadges", async function () {
    //rarity top 100

    expect(
      await exists(
        rarityRFSzn7[10].toString(),
        itemTypes[13].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);

    expect(
      await exists(
        rarityRFSzn7[99].toString(),
        itemTypes[13].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);

    //kinship top 100

    expect(
      await exists(
        kinshipRFSzn7[10].toString(),
        itemTypes[14].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);

    expect(
      await exists(
        kinshipRFSzn7[99].toString(),
        itemTypes[14].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);

    //XP top 100
    expect(
      await exists(
        xpRFSzn7[10].toString(),
        itemTypes[15].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);

    expect(
      await exists(
        xpRFSzn7[99].toString(),
        itemTypes[15].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);
  });
});

async function exists(tokenId: string, itemId: string, items: ItemsFacet) {
  const c = await varsForNetwork(ethers);
  let bal = await items.balanceOfToken(c.aavegotchiDiamond!, tokenId, itemId);

  return bal.gt(0);
}
async function getItemTypesForSzn7Baadges() {
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

  const { itemTypes: allItemTypes } = await import(
    "../data/itemTypes/itemTypes"
  );
  const { toItemTypeInputNew } = await import("../scripts/itemTypeHelpers");

  const itemTypes = baadgeIds.map((id) => {
    const itemType = allItemTypes.find((type) => Number(type.svgId) === id);

    if (!itemType) {
      throw new Error(`Item type with svgId ${id} not found in itemTypes data`);
    }

    return toItemTypeInputNew(itemType);
  });

  return itemTypes;
}
