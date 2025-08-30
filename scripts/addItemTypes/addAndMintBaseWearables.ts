import { ethers, run } from "hardhat";

import { uploadOrUpdateSvg } from "../../scripts/svgHelperFunctions";
import { getRelayerSigner } from "../helperFunctions";
import { varsForNetwork } from "../../helpers/constants";
import { itemTypes } from "../../data/itemTypes/itemTypes";
import { getItemTypes, toItemTypeInputNew } from "../itemTypeHelpers";
import { getWearables } from "../../svgs/allWearables";
import { sideViewDimensions } from "../../data/itemTypes/baseWearableSideWearables";
import { convertSideDimensionsToTaskFormat } from "../../tasks/updateItemSideDimensions";
import { BigNumberish } from "ethers";
import {
  wearablesBackSvgs,
  wearablesLeftSvgs,
  wearablesRightSvgs,
  wearablesBackSleeveSvgs,
  wearablesLeftSleeveSvgs,
  wearablesRightSleeveSvgs,
} from "../../svgs/wearables-sides";

function assertWearableGroupsExist(
  itemIds: number[],
  groups: Record<string, unknown[]>
) {
  for (let index = 0; index < itemIds.length; index++) {
    const itemId = itemIds[index];
    for (const [groupName, groupArr] of Object.entries(groups)) {
      if (!groupArr[index])
        throw new Error(`Wearable ${itemId} not found in ${groupName}`);
    }
  }
}

async function main() {
  const c = await varsForNetwork(ethers);
  //@ts-ignore
  const signer = await getRelayerSigner(hre);

  const address = await signer.getAddress();
  console.log("address:", address);

  //first assert that wearables and sleeves are valid
  const { sleeves, wearables } = getWearables();

  //add itemTypes

  const daoFacet = await ethers.getContractAt(
    "DAOFacet",
    c.aavegotchiDiamond!,
    signer
  );

  const itemIds = [418, 419, 420];

  const itemTypesToAdd = itemIds.map((id) => itemTypes[id]);
  const itemTypesToAdd2 = itemTypesToAdd.map((item) =>
    toItemTypeInputNew(item)
  );
  const finalItemTypes = getItemTypes(itemTypesToAdd2, ethers);

  const sleeveIds = itemTypesToAdd
    .map((item) => item.sleeves)
    .filter((s) => s !== undefined);

  const sleeveSvgs = sleeveIds.map((s) => sleeves[Number(s.sleeveId)]);

  let tx;
  tx = await daoFacet.addItemTypes(finalItemTypes);
  await tx.wait();
  console.log("Item types added");

  // upload dimensions
  await run(
    "updateItemSideDimensions",
    convertSideDimensionsToTaskFormat(sideViewDimensions, c.aavegotchiDiamond!)
  );

  //wearables

  const wearableGroups = {
    wearables: itemIds.map((id) => wearables[id]),
    "wearables-left": itemIds.map((id) => wearablesLeftSvgs[id]),
    "wearables-right": itemIds.map((id) => wearablesRightSvgs[id]),
    "wearables-back": itemIds.map((id) => wearablesBackSvgs[id]),
  };

  assertWearableGroupsExist(itemIds, wearableGroups);

  const sleeveGroups = {
    sleeves: sleeveSvgs.map((s) => s.svg),
    "sleeves-left": sleeveIds.map(
      (sleeveId) => wearablesLeftSleeveSvgs[Number(sleeveId.sleeveId)]
    ),
    "sleeves-right": sleeveIds.map(
      (sleeveId) => wearablesRightSleeveSvgs[Number(sleeveId.sleeveId)]
    ),
    "sleeves-back": sleeveIds.map(
      (sleeveId) => wearablesBackSleeveSvgs[Number(sleeveId.sleeveId)]
    ),
  };

  //add in errors if sleeves are not found in sleeveGroups
  for (let index = 0; index < sleeveIds.length; index++) {
    const sleeveId = sleeveIds[index];
    if (!sleeveGroups["sleeves-left"][index]) {
      throw new Error(`Sleeve ${sleeveId.sleeveId} not found in sleeves-left`);
    }
    if (!sleeveGroups["sleeves-right"][index]) {
      throw new Error(`Sleeve ${sleeveId.sleeveId} not found in sleeves-right`);
    }
    if (!sleeveGroups["sleeves-back"][index]) {
      throw new Error(`Sleeve ${sleeveId.sleeveId} not found in sleeves-back`);
    }
  }

  const svgFacet = await ethers.getContractAt(
    "SvgFacet",
    c.aavegotchiDiamond!,
    signer
  );

  for (const svgGroup of Object.entries(wearableGroups)) {
    const svgData = svgGroup[1];
    const svgType = svgGroup[0];
    await uploadOrUpdateSvg(svgData, svgType, itemIds, svgFacet, ethers);
  }

  for (const svgGroup of Object.entries(sleeveGroups)) {
    const svgData = svgGroup[1];
    const svgType = svgGroup[0];
    await uploadOrUpdateSvg(
      svgData,
      svgType,
      sleeveIds.map((s) => Number(s.sleeveId)),
      svgFacet,
      ethers
    );
  }

  // console.log(sleevesInput);
  // //associate sleeves with body wearable svgs
  tx = await svgFacet.setSleeves(sleeveIds);
  await tx.wait();
  console.log("Sleeves associated with body wearable svgs");

  //mint wearables to forge diamond
  //maxQuantites from the

  const quantities = itemTypesToAdd.map((item) => item.maxQuantity);
  console.log("quantities:", quantities);
  const mintTx = await daoFacet.mintItems(c.forgeDiamond!, itemIds, quantities);
  await mintTx.wait();
  console.log("Wearables minted to forge diamond");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
