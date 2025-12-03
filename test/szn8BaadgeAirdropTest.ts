import { ethers, network } from "hardhat";
import { ItemsFacet } from "../typechain";
import { dataArgs as dataArgs1 } from "../data/airdrops/rarityfarming/szn8/rnd1";
import { dataArgs as dataArgs2 } from "../data/airdrops/rarityfarming/szn8/rnd2";
import { dataArgs as dataArgs3 } from "../data/airdrops/rarityfarming/szn8/rnd3";
import { dataArgs as dataArgs4 } from "../data/airdrops/rarityfarming/szn8/rnd4";

import {
  baseRelayerAddress,
  impersonate,
  rankIds,
} from "../scripts/helperFunctions";
import { main } from "../scripts/airdrops/rfSzn8BdgsAirdrop";
import { getGotchisForASeason } from "../scripts/getAavegotchisForRF";
import { varsForNetwork } from "../helpers/constants";
import { ItemTypeInputNew } from "../scripts/itemTypeHelpers";
import { expect } from "chai";

describe("Airdrop SZN8 Baadges", async function () {
  this.timeout(200000000);

  let itemsFacet: ItemsFacet,
    rarityRFSzn8: number[],
    kinshipRFSzn8: number[],
    xpRFSzn8: number[],
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

    itemTypes = await getItemTypesForSzn8Baadges();

    let tieBreaker = await getGotchisForASeason("8", "matic");
    const [rarityBreaker, kinshipBreaker, xpBreaker] = tieBreaker;

    rarityRFSzn8 = (await rankIds(rarityArray, rarityBreaker)).map((id) =>
      Number(id)
    );

    kinshipRFSzn8 = (await rankIds(kinshipArray, kinshipBreaker)).map((id) =>
      Number(id)
    );

    xpRFSzn8 = (await rankIds(xpArray, xpBreaker)).map((id) => Number(id));

    await main();
  });

  it("Should airdrop szn8 champion baadges", async function () {
    expect(
      await exists(
        rarityRFSzn8[0].toString(),
        itemTypes[0].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);

    expect(
      await exists(
        kinshipRFSzn8[0].toString(),
        itemTypes[1].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);

    expect(
      await exists(
        xpRFSzn8[0].toString(),
        itemTypes[2].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);
  });

  it("Should airdrop szn8 2nd and 3rd place baadges", async function () {
    expect(
      await exists(
        rarityRFSzn8[1].toString(),
        itemTypes[3].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);

    expect(
      await exists(
        kinshipRFSzn8[1].toString(),
        itemTypes[4].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);

    expect(
      await exists(
        xpRFSzn8[1].toString(),
        itemTypes[5].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);

    expect(
      await exists(
        rarityRFSzn8[2].toString(),
        itemTypes[6].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);

    expect(
      await exists(
        kinshipRFSzn8[2].toString(),
        itemTypes[7].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);

    expect(
      await exists(
        xpRFSzn8[2].toString(),
        itemTypes[8].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);
  });

  it("Should airdrop szn8 top10 baadges", async function () {
    expect(
      await exists(
        rarityRFSzn8[3].toString(),
        itemTypes[10].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);

    expect(
      await exists(
        rarityRFSzn8[9].toString(),
        itemTypes[10].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);

    expect(
      await exists(
        kinshipRFSzn8[3].toString(),
        itemTypes[11].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);

    expect(
      await exists(
        kinshipRFSzn8[9].toString(),
        itemTypes[11].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);

    expect(
      await exists(
        xpRFSzn8[3].toString(),
        itemTypes[12].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);

    expect(
      await exists(
        xpRFSzn8[9].toString(),
        itemTypes[12].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);
  });

  it("Should airdrop szn8 top100 baadges", async function () {
    expect(
      await exists(
        rarityRFSzn8[10].toString(),
        itemTypes[13].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);

    expect(
      await exists(
        rarityRFSzn8[99].toString(),
        itemTypes[13].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);

    expect(
      await exists(
        kinshipRFSzn8[10].toString(),
        itemTypes[14].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);

    expect(
      await exists(
        kinshipRFSzn8[99].toString(),
        itemTypes[14].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);

    expect(
      await exists(
        xpRFSzn8[10].toString(),
        itemTypes[15].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);

    expect(
      await exists(
        xpRFSzn8[99].toString(),
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
async function getItemTypesForSzn8Baadges() {
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
