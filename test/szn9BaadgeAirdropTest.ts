import { ethers, network } from "hardhat";
import { ItemsFacet } from "../typechain";
import { dataArgs as dataArgs1 } from "../data/airdrops/rarityfarming/szn9/rnd1";
import { dataArgs as dataArgs2 } from "../data/airdrops/rarityfarming/szn9/rnd2";
import { dataArgs as dataArgs3 } from "../data/airdrops/rarityfarming/szn9/rnd3";
import { dataArgs as dataArgs4 } from "../data/airdrops/rarityfarming/szn9/rnd4";

import {
  baseRelayerAddress,
  impersonate,
  rankIds,
} from "../scripts/helperFunctions";
import { main } from "../scripts/airdrops/rfSzn9BdgsAirdrop";
import { getGotchisForASeason } from "../scripts/getAavegotchisForRF";
import { varsForNetwork } from "../helpers/constants";
import { ItemTypeInputNew } from "../scripts/itemTypeHelpers";
import { expect } from "chai";

describe("Airdrop SZN9 Baadges", async function () {
  this.timeout(200000000);

  let itemsFacet: ItemsFacet,
    rarityRFSzn9: number[],
    kinshipRFSzn9: number[],
    xpRFSzn9: number[],
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

    itemTypes = await getItemTypesForSzn9Baadges();

    const [rarityBreaker, kinshipBreaker, xpBreaker] =
      await getGotchisForASeason("9", "matic");

    rarityRFSzn9 = (await rankIds(rarityArray, rarityBreaker)).map((id) =>
      Number(id)
    );

    kinshipRFSzn9 = (await rankIds(kinshipArray, kinshipBreaker)).map((id) =>
      Number(id)
    );

    xpRFSzn9 = (await rankIds(xpArray, xpBreaker)).map((id) => Number(id));

    await main();
  });

  it("Should airdrop szn9 champion baadges", async function () {
    expect(
      await exists(
        rarityRFSzn9[0].toString(),
        itemTypes[0].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);

    expect(
      await exists(
        kinshipRFSzn9[0].toString(),
        itemTypes[1].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);

    expect(
      await exists(
        xpRFSzn9[0].toString(),
        itemTypes[2].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);
  });

  it("Should airdrop szn9 2nd and 3rd place baadges", async function () {
    expect(
      await exists(
        rarityRFSzn9[1].toString(),
        itemTypes[3].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);

    expect(
      await exists(
        kinshipRFSzn9[1].toString(),
        itemTypes[4].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);

    expect(
      await exists(
        xpRFSzn9[1].toString(),
        itemTypes[5].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);

    expect(
      await exists(
        rarityRFSzn9[2].toString(),
        itemTypes[6].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);

    expect(
      await exists(
        kinshipRFSzn9[2].toString(),
        itemTypes[7].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);

    expect(
      await exists(
        xpRFSzn9[2].toString(),
        itemTypes[8].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);
  });

  it("Should airdrop szn9 top10 baadges", async function () {
    expect(
      await exists(
        rarityRFSzn9[3].toString(),
        itemTypes[10].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);

    expect(
      await exists(
        rarityRFSzn9[9].toString(),
        itemTypes[10].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);

    expect(
      await exists(
        kinshipRFSzn9[3].toString(),
        itemTypes[11].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);

    expect(
      await exists(
        kinshipRFSzn9[9].toString(),
        itemTypes[11].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);

    expect(
      await exists(
        xpRFSzn9[3].toString(),
        itemTypes[12].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);

    expect(
      await exists(
        xpRFSzn9[9].toString(),
        itemTypes[12].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);
  });

  it("Should airdrop szn9 top100 baadges", async function () {
    expect(
      await exists(
        rarityRFSzn9[10].toString(),
        itemTypes[13].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);

    expect(
      await exists(
        rarityRFSzn9[99].toString(),
        itemTypes[13].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);

    expect(
      await exists(
        kinshipRFSzn9[10].toString(),
        itemTypes[14].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);

    expect(
      await exists(
        kinshipRFSzn9[99].toString(),
        itemTypes[14].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);

    expect(
      await exists(
        xpRFSzn9[10].toString(),
        itemTypes[15].svgId.toString(),
        itemsFacet
      )
    ).to.equal(true);

    expect(
      await exists(
        xpRFSzn9[99].toString(),
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
async function getItemTypesForSzn9Baadges() {
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
