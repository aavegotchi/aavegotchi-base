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
import {
  getAllItemTypes,
  toItemTypeInputNew,
} from "../scripts/itemTypeHelpers";
import { sideViewDimensions } from "../data/itemTypes/baseWearableSideWearables";
import { convertSideDimensionsToTaskFormat } from "./updateItemSideDimensions";
import {
  confirmChecklist,
  verifyDeploymentOnchain,
} from "../scripts/newWearableChecklist";
import { gasPrice } from "../scripts/helperFunctions";
import { allBadges } from "../svgs/BadgeData";
import { badge as getBadgeSvg } from "../svgs/allBadges";
import { getItemTypes } from "../scripts/itemTypeHelpers";

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

      // Partition into badgeIds and wearableIds
      const badgeIds = itemIds.filter((id) => allBadges.includes(id));
      const wearableIds = itemIds.filter((id) => !allBadges.includes(id));
      console.log(
        `Partitioned IDs → badges: [${badgeIds.join(
          ", "
        )}] wearables: [${wearableIds.join(", ")}]`
      );

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

      const itemsFacet = await hre.ethers.getContractAt(
        "ItemsFacet",
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
      const finalItemTypes = getAllItemTypes(
        itemTypesToAdd.map((item) => toItemTypeInputNew(item)),
        hre.ethers
      );

      // Upload wearable svgs (non-badges)
      if (wearableIds.length > 0) {
        console.log(
          `🎨 Uploading wearable SVGs for items: ${wearableIds.join(", ")}`
        );
        const wearableGroups = generateWearableGroups(wearableIds);
        for (const svgGroup of Object.entries(wearableGroups)) {
          const svgData = svgGroup[1] as string[];
          const svgType = svgGroup[0];
          console.log(`📤 Processing ${svgType} SVGs...`);
          await uploadOrUpdateSvg(
            svgData,
            svgType,
            wearableIds,
            svgFacet,
            hre.ethers,
            undefined,
            gasConfig
          );
        }
      } else {
        console.log("No wearable IDs detected for SVG upload.");
      }

      // Upload badge svgs (front-only as wearables)
      if (badgeIds.length > 0) {
        console.log(
          `🎖️ Uploading badge SVGs for items: ${badgeIds.join(", ")}`
        );
        const badgeSvgs: string[] = badgeIds.map((id) => getBadgeSvg(id));
        await uploadOrUpdateSvg(
          badgeSvgs,
          "wearables",
          badgeIds,
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
        //also log the itemiDs and quantities
        console.table({
          itemIds,
          quantities: finalItemTypes.map((item) => item.maxQuantity),
        });
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
      // console.log("Updating item side dimensions...");
      // await hre.run(
      //   "updateItemSideDimensions",
      //   convertSideDimensionsToTaskFormat(
      //     sideViewDimensions,
      //     c.aavegotchiDiamond!
      //   )
      // );

      // Mint wearables to forge diamond
      console.log("Minting items to recipient...");
      const quantities = itemTypesToAdd.map((item) => item.maxQuantity);
      //do a table log of the item ids and quantities
      console.table({ itemIds, quantities });
      // //before minting, log the max quantities onchain
      // const maxQuantities = await itemsFacet
      //   .getItemTypes(itemIds)
      //   .then((items) => items.map((item) => item.maxQuantity.toNumber()));
      // console.log("maxQuantities onchain:");
      // console.table({ itemIds, maxQuantities });

      const mintTx = await daoFacet.mintItems(
        recipient,
        itemIds,
        quantities,
        gasConfig
      );
      await mintTx.wait();
      console.log("Items minted to recipient");

      console.log("✅ All operations completed successfully!");

      // Post-deployment verification
      await verifyDeploymentOnchain(itemIds, hre, recipient);

      //Export SVG of Aavegotchi wearing the new wearables
      console.log("Exporting SVG of Aavegotchi wearing the new wearables...");
    }
  );
