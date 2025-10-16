import { ethers, network } from "hardhat";
import { ItemsFacet } from "../typechain";
import { dataArgs as dataArgs1 } from "../data/airdrops/rarityfarming/szn10/rnd1";
import { dataArgs as dataArgs2 } from "../data/airdrops/rarityfarming/szn10/rnd2";
import { dataArgs as dataArgs3 } from "../data/airdrops/rarityfarming/szn10/rnd3";
import { dataArgs as dataArgs4 } from "../data/airdrops/rarityfarming/szn10/rnd4";

import {
  baseRelayerAddress,
  impersonate,
  rankIds,
} from "../scripts/helperFunctions";
import { main } from "../scripts/airdrops/rfSzn10BdgsAirdrop";
import { getGotchisForASeason } from "../scripts/getAavegotchisForRF";
import { varsForNetwork } from "../helpers/constants";
import { ItemTypeInputNew } from "../scripts/itemTypeHelpers";
import { expect } from "chai";

describe("Airdrop SZN10 Baadges", async function () {
  this.timeout(200000000);

  let itemsFacet: ItemsFacet,
    rarityRFSzn10: number[],
    kinshipRFSzn10: number[],
    xpRFSzn10: number[],
    itemTypes: ItemTypeInputNew[];

  before(async function () {
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

    itemTypes = await getItemTypesForSzn10Baadges();

    const [rarityBreaker, kinshipBreaker, xpBreaker] =
      await getGotchisForASeason("10");

    rarityRFSzn10 = (await rankIds(rarityArray, rarityBreaker)).map((id) =>
      Number(id)
    );

    kinshipRFSzn10 = (await rankIds(kinshipArray, kinshipBreaker)).map((id) =>
      Number(id)
    );

    xpRFSzn10 = (await rankIds(xpArray, xpBreaker)).map((id) => Number(id));

    await main();
  });

  it("Should airdrop szn10 champion baadges", async function () {
    expect(
      await exists(
        rarityRFSzn10[0].toString(),
        itemTypes[0].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);

    expect(
      await exists(
        kinshipRFSzn10[0].toString(),
        itemTypes[1].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);

    expect(
      await exists(
        xpRFSzn10[0].toString(),
        itemTypes[2].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);
  });

  it("Should airdrop szn10 2nd and 3rd place baadges", async function () {
    expect(
      await exists(
        rarityRFSzn10[1].toString(),
        itemTypes[3].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);

    expect(
      await exists(
        kinshipRFSzn10[1].toString(),
        itemTypes[4].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);

    expect(
      await exists(
        xpRFSzn10[1].toString(),
        itemTypes[5].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);

    expect(
      await exists(
        rarityRFSzn10[2].toString(),
        itemTypes[6].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);

    expect(
      await exists(
        kinshipRFSzn10[2].toString(),
        itemTypes[7].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);

    expect(
      await exists(
        xpRFSzn10[2].toString(),
        itemTypes[8].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);
  });

  it("Should airdrop szn10 top10 baadges", async function () {
    expect(
      await exists(
        rarityRFSzn10[3].toString(),
        itemTypes[10].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);

    expect(
      await exists(
        rarityRFSzn10[9].toString(),
        itemTypes[10].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);

    expect(
      await exists(
        kinshipRFSzn10[3].toString(),
        itemTypes[11].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);

    expect(
      await exists(
        kinshipRFSzn10[9].toString(),
        itemTypes[11].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);

    expect(
      await exists(
        xpRFSzn10[3].toString(),
        itemTypes[12].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);

    expect(
      await exists(
        xpRFSzn10[9].toString(),
        itemTypes[12].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);
  });

  it("Should airdrop szn10 top100 baadges", async function () {
    expect(
      await exists(
        rarityRFSzn10[10].toString(),
        itemTypes[13].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);

    expect(
      await exists(
        rarityRFSzn10[99].toString(),
        itemTypes[13].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);

    expect(
      await exists(
        kinshipRFSzn10[10].toString(),
        itemTypes[14].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);

    expect(
      await exists(
        kinshipRFSzn10[99].toString(),
        itemTypes[14].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);

    expect(
      await exists(
        xpRFSzn10[10].toString(),
        itemTypes[15].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);

    expect(
      await exists(
        xpRFSzn10[99].toString(),
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
async function getItemTypesForSzn10Baadges() {
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

