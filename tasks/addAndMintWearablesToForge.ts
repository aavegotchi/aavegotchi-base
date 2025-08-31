import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { uploadOrUpdateSvg } from "../scripts/svgHelperFunctions";
import {
  generateSleeveGroups,
  generateWearableGroups,
  getRelayerSigner,
} from "../scripts/helperFunctions";
import { varsForNetwork } from "../helpers/constants";
import { itemTypes } from "../data/itemTypes/itemTypes";
import { getItemTypes, toItemTypeInputNew } from "../scripts/itemTypeHelpers";
import { sideViewDimensions } from "../data/itemTypes/baseWearableSideWearables";
import { convertSideDimensionsToTaskFormat } from "./updateItemSideDimensions";

export interface AddAndMintWearablesToForgeTaskArgs {
  itemIds: string;
}

task(
  "addAndMintBaseWearablesToForge",
  "Adds item types and mints base wearables to forge diamond"
)
  .addParam(
    "itemIds",
    "Comma-separated list of item IDs to add and mint (e.g., '418,419,420')"
  )
  .setAction(
    async (
      taskArgs: AddAndMintWearablesToForgeTaskArgs,
      hre: HardhatRuntimeEnvironment
    ) => {
      const c = await varsForNetwork(hre.ethers);
      const signer = await getRelayerSigner(hre);

      const daoFacet = await hre.ethers.getContractAt(
        "DAOFacet",
        c.aavegotchiDiamond!,
        signer
      );

      // Parse item IDs from input parameter
      const itemIds = taskArgs.itemIds
        .split(",")
        .map((id) => parseInt(id.trim()));
      console.log(`Processing item IDs: ${itemIds.join(", ")}`);

      const itemTypesToAdd = itemIds.map((id) => {
        if (!itemTypes[id]) {
          throw new Error(
            `Item type with ID ${id} not found in itemTypes data`
          );
        }
        return itemTypes[id];
      });

      // Get item types
      const finalItemTypes = getItemTypes(
        itemTypesToAdd.map((item) => toItemTypeInputNew(item)),
        hre.ethers
      );

      // Get sleeve ids
      const sleeveIds = itemTypesToAdd
        .map((item) => item.sleeves)
        .filter((s) => s !== undefined);

      // Add item types
      console.log(`Adding ${finalItemTypes.length} item types...`);
      const tx = await daoFacet.addItemTypes(finalItemTypes);
      await tx.wait();
      console.log("Item types added");

      // Upload dimensions
      console.log("Updating item side dimensions...");
      await hre.run(
        "updateItemSideDimensions",
        convertSideDimensionsToTaskFormat(
          sideViewDimensions,
          c.aavegotchiDiamond!
        )
      );

      // Upload svgs
      const svgFacet = await hre.ethers.getContractAt(
        "SvgFacet",
        c.aavegotchiDiamond!,
        signer
      );

      // Upload wearable svgs
      console.log("Uploading wearable SVGs...");
      const wearableGroups = generateWearableGroups(itemIds);
      for (const svgGroup of Object.entries(wearableGroups)) {
        const svgData = svgGroup[1] as string[];
        const svgType = svgGroup[0];
        await uploadOrUpdateSvg(
          svgData,
          svgType,
          itemIds,
          svgFacet,
          hre.ethers
        );
      }

      // Upload sleeve svgs
      if (sleeveIds.length > 0) {
        console.log("Uploading sleeve SVGs...");
        const sleeveGroups = generateSleeveGroups(
          sleeveIds.map((s) => Number(s.sleeveId))
        );
        for (const svgGroup of Object.entries(sleeveGroups)) {
          const svgData = svgGroup[1];
          const svgType = svgGroup[0];
          await uploadOrUpdateSvg(
            svgData,
            svgType,
            sleeveIds.map((s) => Number(s.sleeveId)),
            svgFacet,
            hre.ethers
          );
        }

        // Associate sleeves with body wearable svgs
        console.log("Associating sleeves with body wearable SVGs...");
        const setSleevesTx = await svgFacet.setSleeves(sleeveIds);
        await setSleevesTx.wait();
        console.log(
          `${sleeveIds.length} sleeves associated with body wearable svgs`
        );
      }

      // Mint wearables to forge diamond
      console.log("Minting wearables to forge diamond...");
      const quantities = itemTypesToAdd.map((item) => item.maxQuantity);
      const mintTx = await daoFacet.mintItems(
        c.forgeDiamond!,
        itemIds,
        quantities
      );
      await mintTx.wait();
      console.log("Wearables minted to forge diamond");

      console.log("✅ All operations completed successfully!");
    }
  );
