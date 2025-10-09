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
import {
  confirmChecklist,
  verifyDeploymentOnchain,
} from "../scripts/newWearableChecklist";
import { gasPrice } from "../scripts/helperFunctions";

export interface AddAndMintWearablesToForgeTaskArgs {
  itemIds: string;
  recipient: string;
}

task(
  "addAndMintBaseWearables",
  "Adds item types and mints base wearables to forge diamond"
)
  .addParam(
    "itemIds",
    "Comma-separated list of item IDs to add and mint (e.g., '418,419,420')"
  )
  .addParam("recipient", "Address to mint wearables to")
  .setAction(
    async (
      taskArgs: AddAndMintWearablesToForgeTaskArgs,
      hre: HardhatRuntimeEnvironment
    ) => {
      // Parse item IDs from input parameter
      const itemIds = taskArgs.itemIds
        .split(",")
        .map((id) => parseInt(id.trim()));
      const recipient = taskArgs.recipient;
      console.log(`Processing item IDs: ${itemIds.join(", ")}`);

      // Pre-deployment validation
      const shouldProceed = await confirmChecklist(itemIds, hre);
      if (!shouldProceed) {
        console.log("❌ Operation cancelled by user.");
        return;
      }

      const c = await varsForNetwork(hre.ethers);
      const signer = await getRelayerSigner(hre);

      // Configure gas settings based on network
      const testing = ["hardhat", "localhost"].includes(hre.network.name);
      const gasConfig = testing ? { gasPrice: gasPrice } : {};

      const daoFacet = await hre.ethers.getContractAt(
        "DAOFacet",
        c.aavegotchiDiamond!,
        signer
      );

      // Upload svgs
      const svgFacet = await hre.ethers.getContractAt(
        "SvgFacet",
        c.aavegotchiDiamond!,
        signer
      );

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

      // Upload wearable svgs
      console.log(
        `🎨 Uploading wearable SVGs for items: ${itemIds.join(", ")}`
      );
      const wearableGroups = generateWearableGroups(itemIds);

      for (const svgGroup of Object.entries(wearableGroups)) {
        const svgData = svgGroup[1] as string[];
        const svgType = svgGroup[0];
        console.log(`📤 Processing ${svgType} SVGs...`);
        await uploadOrUpdateSvg(
          svgData,
          svgType,
          itemIds,
          svgFacet,
          hre.ethers,
          undefined,
          gasConfig
        );
      }

      // Get sleeve ids
      const sleeveIds = itemTypesToAdd
        .map((item) => item.sleeves)
        .filter((s) => s !== undefined);

      // Add item types (must be done regardless of sleeves)
      try {
        console.log(`Adding ${finalItemTypes.length} item types...`);
        const tx = await daoFacet.addItemTypes(finalItemTypes, gasConfig);
        await tx.wait();
        console.log("Item types added in tx:", tx.hash);
      } catch (error) {
        console.error("Error adding item types:", error);
        throw error;
      }

      // Upload sleeve svgs
      if (sleeveIds.length > 0) {
        const sleeveIdNumbers = sleeveIds.map((s) => Number(s.sleeveId));
        console.log(
          `👕 Uploading sleeve SVGs for sleeves: ${sleeveIdNumbers.join(", ")}`
        );
        const sleeveGroups = generateSleeveGroups(sleeveIdNumbers);
        for (const svgGroup of Object.entries(sleeveGroups)) {
          const svgData = svgGroup[1];
          const svgType = svgGroup[0];
          console.log(`📤 Processing ${svgType} SVGs...`);
          await uploadOrUpdateSvg(
            svgData,
            svgType,
            sleeveIdNumbers,
            svgFacet,
            hre.ethers,
            undefined,
            gasConfig
          );
        }

        // Associate sleeves with body wearable svgs
        console.log("Associating sleeves with body wearable SVGs...");
        const setSleevesTx = await svgFacet.setSleeves(sleeveIds, gasConfig);
        await setSleevesTx.wait();
        console.log(
          `${sleeveIds.length} sleeves associated with body wearable svgs`
        );
      }

      // Upload dimensions (must be done regardless of sleeves)
      console.log("Updating item side dimensions...");
      await hre.run(
        "updateItemSideDimensions",
        convertSideDimensionsToTaskFormat(
          sideViewDimensions,
          c.aavegotchiDiamond!
        )
      );

      // Mint wearables to forge diamond
      console.log("Minting wearables to recipient...");
      const quantities = itemTypesToAdd.map((item) => item.maxQuantity);
      //do a table log of the item ids and quantities
      console.table({ itemIds, quantities });
      const mintTx = await daoFacet.mintItems(
        recipient,
        itemIds,
        quantities,
        gasConfig
      );
      await mintTx.wait();
      console.log("Wearables minted to recipient");

      console.log("✅ All operations completed successfully!");

      // Post-deployment verification
      await verifyDeploymentOnchain(itemIds, hre, recipient);

      //Export SVG of Aavegotchi wearing the new wearables
      console.log("Exporting SVG of Aavegotchi wearing the new wearables...");
    }
  );
