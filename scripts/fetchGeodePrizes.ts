import { ethers } from "hardhat";
import { ItemsFacet } from "../typechain";
import { BigNumber } from "ethers";

export async function getPrizes(
  blockNumber: number,
  c: any,
  forgeDAOFacet: any,
  itemsFacet: any
) {
  //get previous prizes
  const items = await forgeDAOFacet.getGeodePrizesRemaining({
    blockTag: blockNumber,
  });
  //only print out an array of the itemIds and balances
  const modifiers = await getModifiers(items[0], itemsFacet);

  //get full 3 arg array
  const fullArray = [items[0], items[1], modifiers];

  //get current prizes
  const currentItems = await forgeDAOFacet.getGeodePrizesRemaining({
    blockTag: await ethers.provider.getBlockNumber(),
  });
  const currentModifiers = await getModifiers(currentItems[0], itemsFacet);

  //combine each array
  const currentFullArray = [currentItems[0], currentItems[1], currentModifiers];

  //consolidate the two arrays
  const consolidatedArray = [
    [...fullArray[0], ...currentFullArray[0]],
    [...fullArray[1], ...currentFullArray[1]],
    [...fullArray[2], ...currentFullArray[2]],
  ];

  console.log("TokenId --> Amount --> Rarity");
  for (let i = 0; i < consolidatedArray[0].length; i++) {
    console.log(
      Number(consolidatedArray[0][i]),
      "-->",
      Number(consolidatedArray[1][i]),
      "-->",
      Number(consolidatedArray[2][i])
    );
    console.log("--------------------------------");
  }

  return consolidatedArray;
}

export async function getModifiers(ids: BigNumber[], itemsFacet: ItemsFacet) {
  let modifiers: number[] = [];

  for (const id of ids) {
    const item = await itemsFacet.getItemTypes([id]);
    modifiers.push(Number(item[0].rarityScoreModifier));
  }

  return modifiers;
}
