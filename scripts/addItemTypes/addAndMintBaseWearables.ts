import { ethers, run } from "hardhat";

import { uploadOrUpdateSvg } from "../../scripts/svgHelperFunctions";
import {
  generateSleeveGroups,
  generateWearableGroups,
  getRelayerSigner,
} from "../helperFunctions";
import { varsForNetwork } from "../../helpers/constants";
import { itemTypes } from "../../data/itemTypes/itemTypes";
import { getItemTypes, toItemTypeInputNew } from "../itemTypeHelpers";
import { getWearables } from "../../svgs/allWearables";
import { sideViewDimensions } from "../../data/itemTypes/baseWearableSideWearables";
import { convertSideDimensionsToTaskFormat } from "../../tasks/updateItemSideDimensions";

async function main() {
  const c = await varsForNetwork(ethers);
  //@ts-ignore
  const signer = await getRelayerSigner(hre);

  const daoFacet = await ethers.getContractAt(
    "DAOFacet",
    c.aavegotchiDiamond!,
    signer
  );

  //first assert that wearables and sleeves are valid
  const { sleeves, wearables } = getWearables();

  //Set item ids for script
  const itemIds = [418, 419, 420];
  const itemTypesToAdd = itemIds.map((id) => itemTypes[id]);

  //get item types
  const finalItemTypes = getItemTypes(
    itemTypesToAdd.map((item) => toItemTypeInputNew(item)),
    ethers
  );

  //get sleeve ids
  const sleeveIds = itemTypesToAdd
    .map((item) => item.sleeves)
    .filter((s) => s !== undefined);

  //get sleeve svgs
  const sleeveSvgs = sleeveIds.map((s) => sleeves[Number(s.sleeveId)]);

  //add item types
  const tx = await daoFacet.addItemTypes(finalItemTypes);
  await tx.wait();
  console.log("Item types added");

  // upload dimensions
  await run(
    "updateItemSideDimensions",
    convertSideDimensionsToTaskFormat(sideViewDimensions, c.aavegotchiDiamond!)
  );

  //upload svgs
  const svgFacet = await ethers.getContractAt(
    "SvgFacet",
    c.aavegotchiDiamond!,
    signer
  );

  //upload wearable svgs
  const wearableGroups = generateWearableGroups(itemIds, wearables);
  for (const svgGroup of Object.entries(wearableGroups)) {
    const svgData = svgGroup[1] as string[];
    const svgType = svgGroup[0];
    await uploadOrUpdateSvg(svgData, svgType, itemIds, svgFacet, ethers);
  }

  //upload sleeve svgs
  const sleeveGroups = generateSleeveGroups(
    sleeveIds.map((s) => Number(s.sleeveId)),
    sleeveSvgs
  );
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

  //associate sleeves with body wearable svgs
  const setSleevesTx = await svgFacet.setSleeves(sleeveIds);
  await setSleevesTx.wait();
  console.log("Sleeves associated with body wearable svgs");

  //mint wearables to forge diamond
  const quantities = itemTypesToAdd.map((item) => item.maxQuantity);
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
