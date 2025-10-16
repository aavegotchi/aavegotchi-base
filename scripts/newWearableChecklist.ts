import { itemTypes } from "../data/itemTypes/itemTypes";
import {
  getExpectedWearableFilenames,
  getExpectedSleeveFilenames,
} from "../svgs/wearables-sides";
import { varsForNetwork } from "../helpers/constants";
import { getRelayerSigner } from "./helperFunctions";
import * as readline from "readline";
import * as fs from "fs";
import { mine } from "@nomicfoundation/hardhat-network-helpers";
import { allBadges } from "../svgs/BadgeData";
import { badge as getBadgeSvg } from "../svgs/allBadges";

function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

function checkSvgFileExists(filename: string): boolean {
  const path = `./svgs/svgItems/${filename}.svg`;
  return fs.existsSync(path);
}

function validateSvgFiles(filenames: string[]): {
  missing: string[];
  found: string[];
} {
  const missing: string[] = [];
  const found: string[] = [];

  for (const filename of filenames) {
    if (checkSvgFileExists(filename)) {
      found.push(`${filename}.svg`);
    } else {
      missing.push(`${filename}.svg`);
    }
  }

  return { missing, found };
}

async function verifyItemTypesOnchain(
  itemIds: number[],
  hre: any
): Promise<{ verified: number[]; missing: number[] }> {
  const verified: number[] = [];
  const missing: number[] = [];

  try {
    const c = await varsForNetwork(hre.ethers);
    const signer = await getRelayerSigner(hre);

    const itemsFacet = await hre.ethers.getContractAt(
      "ItemsFacet",
      c.aavegotchiDiamond!,
      signer
    );

    for (const itemId of itemIds) {
      try {
        const itemType = await itemsFacet.getItemType(itemId);
        if (itemType && itemType.name) {
          verified.push(itemId);
        } else {
          missing.push(itemId);
        }
      } catch (error) {
        missing.push(itemId);
      }
    }
  } catch (error) {
    console.log(
      "⚠️ Could not connect to contract for verification (this is normal for dry runs)"
    );
    return { verified: [], missing: [] };
  }

  return { verified, missing };
}

async function verifySvgsOnchain(
  itemIds: number[],
  hre: any
): Promise<{ verified: number[]; missing: number[] }> {
  const verified: number[] = [];
  const missing: number[] = [];

  try {
    const c = await varsForNetwork(hre.ethers);
    const signer = await getRelayerSigner(hre);

    const svgFacet = await hre.ethers.getContractAt(
      "SvgFacet",
      c.aavegotchiDiamond!,
      signer
    );

    // For wearables we check 4 views; for badges, only front (wearables)
    const wearableSideViews = [
      { name: "front", category: "wearables" },
      { name: "left", category: "wearables-left" },
      { name: "right", category: "wearables-right" },
      { name: "back", category: "wearables-back" },
    ];

    for (const itemId of itemIds) {
      let itemVerified = true;

      const isBadge = allBadges.includes(itemId);
      const sideViewsToCheck = isBadge
        ? [{ name: "front", category: "wearables" }]
        : wearableSideViews;

      for (const sideView of sideViewsToCheck) {
        try {
          const svg = await svgFacet.getSvg(
            hre.ethers.utils.formatBytes32String(sideView.category),
            itemId
          );
          if (!svg || svg.length === 0) {
            console.log(`❌ Missing ${sideView.name} view for item ${itemId}`);
            itemVerified = false;
          } else {
            console.log(
              `✅ ${sideView.name} view for item ${itemId} verified (length: ${svg.length})`
            );
          }
        } catch (error) {
          console.log(
            `❌ Error checking ${sideView.name} view for item ${itemId}: ${error}`
          );
          itemVerified = false;
        }
      }

      if (itemVerified) {
        verified.push(itemId);
      } else {
        missing.push(itemId);
      }
    }
  } catch (error) {
    console.log(
      "⚠️ Could not connect to contract for SVG verification (this is normal for dry runs)"
    );
    return { verified: [], missing: [] };
  }

  return { verified, missing };
}

async function verifySleevesAssociationsOnchain(
  itemIds: number[],
  hre: any
): Promise<{ verified: number[]; missing: number[] }> {
  const verified: number[] = [];
  const missing: number[] = [];

  // Filter to only body wearables with sleeves
  const bodyWearablesWithSleeves = itemIds.filter((itemId) => {
    const itemType = itemTypes[itemId];
    return itemType && itemType.slotPositions === "body" && itemType.sleeves;
  });

  if (bodyWearablesWithSleeves.length === 0) {
    return { verified: [], missing: [] };
  }

  try {
    const c = await varsForNetwork(hre.ethers);
    const signer = await getRelayerSigner(hre);

    const svgFacet = await hre.ethers.getContractAt(
      "SvgFacet",
      c.aavegotchiDiamond!,
      signer
    );

    // Check sleeve associations
    const sleeveAssociations = await svgFacet.getSleeveAssociations(
      bodyWearablesWithSleeves
    );

    for (let i = 0; i < bodyWearablesWithSleeves.length; i++) {
      const itemId = bodyWearablesWithSleeves[i];
      const association = sleeveAssociations[i];

      if (association.sleeveId.gt(0) && association.wearableId.eq(itemId)) {
        verified.push(itemId);
      } else {
        missing.push(itemId);
      }
    }
  } catch (error) {
    console.log(
      "⚠️ Could not connect to contract for sleeve verification (this is normal for dry runs)"
    );
    return { verified: [], missing: [] };
  }

  return { verified, missing };
}

async function verifySleeveSvgsOnchain(
  itemIds: number[],
  hre: any
): Promise<{ verified: number[]; missing: number[] }> {
  const verified: number[] = [];
  const missing: number[] = [];

  // Filter to only body wearables with sleeves
  const bodyWearablesWithSleeves = itemIds.filter((itemId) => {
    const itemType = itemTypes[itemId];
    return itemType && itemType.slotPositions === "body" && itemType.sleeves;
  });

  if (bodyWearablesWithSleeves.length === 0) {
    return { verified: [], missing: [] };
  }

  try {
    const c = await varsForNetwork(hre.ethers);
    const signer = await getRelayerSigner(hre);

    const svgFacet = await hre.ethers.getContractAt(
      "SvgFacet",
      c.aavegotchiDiamond!,
      signer
    );

    // Check all sleeve side views: front, left, right, back
    const sleeveSideViews = [
      { name: "front", category: "sleeves" },
      { name: "left", category: "sleeves-left" },
      { name: "right", category: "sleeves-right" },
      { name: "back", category: "sleeves-back" },
    ];

    // Get sleeve associations to find the sleeve IDs
    const sleeveAssociations = await svgFacet.getSleeveAssociations(
      bodyWearablesWithSleeves
    );

    for (let i = 0; i < bodyWearablesWithSleeves.length; i++) {
      const itemId = bodyWearablesWithSleeves[i];
      const association = sleeveAssociations[i];

      if (association.sleeveId.gt(0)) {
        let sleeveVerified = true;

        for (const sideView of sleeveSideViews) {
          try {
            // Check if the sleeve SVG data exists onchain for each side view
            const sleeveSvg = await svgFacet.getSvg(
              hre.ethers.utils.formatBytes32String(sideView.category),
              association.sleeveId
            );

            if (!sleeveSvg || sleeveSvg.length === 0) {
              console.log(
                `❌ Missing ${sideView.name} sleeve view for item ${itemId} (sleeve ID: ${association.sleeveId})`
              );
              sleeveVerified = false;
            } else {
              console.log(
                `✅ ${sideView.name} sleeve view for item ${itemId} verified (sleeve ID: ${association.sleeveId}, length: ${sleeveSvg.length})`
              );
            }
          } catch (error) {
            console.log(
              `❌ Error checking ${sideView.name} sleeve view for item ${itemId}: ${error}`
            );
            sleeveVerified = false;
          }
        }

        if (sleeveVerified) {
          verified.push(itemId);
        } else {
          missing.push(itemId);
        }
      } else {
        console.log(`❌ No sleeve ID found for item ${itemId}`);
        missing.push(itemId);
      }
    }
  } catch (error) {
    console.log(
      "⚠️ Could not connect to contract for sleeve SVG verification (this is normal for dry runs)"
    );
    return { verified: [], missing: [] };
  }

  return { verified, missing };
}

async function verifyItemBalances(
  itemIds: number[],
  hre: any,
  recipient: string
): Promise<{ verified: number[]; missing: number[] }> {
  const verified: number[] = [];
  const missing: number[] = [];

  try {
    const c = await varsForNetwork(hre.ethers);
    const signer = await getRelayerSigner(hre);

    const itemsFacet = await hre.ethers.getContractAt(
      "ItemsFacet",
      c.aavegotchiDiamond!,
      signer
    );

    console.log(`🔍 Checking item balances for recipient: ${recipient}`);

    for (const itemId of itemIds) {
      try {
        const itemType = itemTypes[itemId];
        if (!itemType) {
          console.log(
            `⚠️ Item ${itemId} not found in itemTypes, skipping balance check`
          );
          continue;
        }

        // Check balance of the recipient for this item
        const balance = await itemsFacet.balanceOf(recipient, itemId);
        const expectedQuantity = itemType.maxQuantity;

        console.log(`📊 Item ${itemId} (${itemType.name}):`);
        console.log(`   Expected: ${expectedQuantity}`);
        console.log(`   Actual: ${balance.toString()}`);

        if (balance.eq(expectedQuantity)) {
          console.log(
            `✅ Balance matches expected quantity for item ${itemId}`
          );
          verified.push(itemId);
        } else {
          console.log(
            `❌ Balance mismatch for item ${itemId}: expected ${expectedQuantity}, got ${balance.toString()}`
          );
          missing.push(itemId);
        }
      } catch (error) {
        console.log(`❌ Error checking balance for item ${itemId}: ${error}`);
        missing.push(itemId);
      }
    }
  } catch (error) {
    console.log(
      "⚠️ Could not connect to contract for balance verification (this is normal for dry runs)"
    );
    return { verified: [], missing: [] };
  }

  return { verified, missing };
}

export async function generateWearablePreviews(
  itemIds: number[],
  hre: any
): Promise<void> {
  try {
    const c = await varsForNetwork(hre.ethers);
    const signer = await getRelayerSigner(hre);

    const svgViewsFacet = await hre.ethers.getContractAt(
      "SvgViewsFacet",
      c.aavegotchiDiamond!,
      signer
    );

    const collateralFacet = await hre.ethers.getContractAt(
      "CollateralFacet",
      c.aavegotchiDiamond!,
      signer
    );

    // Create preview directory if it doesn't exist
    const previewDir = "./preview";
    if (!fs.existsSync(previewDir)) {
      fs.mkdirSync(previewDir, { recursive: true });
    }

    // Get first available collateral type for haunt 1
    const hauntId = 1;
    const collateralTypes = await collateralFacet.collaterals(hauntId);
    const collateralType = collateralTypes[0]; // Use first available collateral (usually DAI)

    // Neutral traits for clean preview
    const numericTraits = [50, 50, 50, 50, 50, 50];

    const badgeIdsForPreview: number[] = [];

    for (const itemId of itemIds) {
      try {
        const itemType = itemTypes[itemId];
        const isBadge = allBadges.includes(itemId);

        if (!itemType) {
          console.log(
            `⚠️ Item ${itemId} not found in itemTypes, skipping preview`
          );
          continue;
        }

        if (isBadge) {
          badgeIdsForPreview.push(itemId);
          continue;
        }

        console.log(
          `⏭️ Skipping wearable preview generation for item ${itemId} (${itemType.name})`
        );
      } catch (error) {
        console.log(
          `❌ Failed to generate preview for item ${itemId}: ${error}`
        );
      }
    }

    if (badgeIdsForPreview.length > 0) {
      console.log(
        `🎖️ Generating badge preview grid for IDs: ${badgeIdsForPreview.join(
          ", "
        )}`
      );

      const chunkSize = 16;
      for (let i = 0; i < badgeIdsForPreview.length; i += chunkSize) {
        const chunk = badgeIdsForPreview.slice(i, i + chunkSize);
        const badgeGridSvg = createBadgeGridPreview(chunk);
        const filename = `${previewDir}/preview_badges_${
          Math.floor(i / chunkSize) + 1
        }.svg`;
        fs.writeFileSync(filename, badgeGridSvg);
        console.log(`✅ Badge grid preview saved to ${filename}`);
      }
    }
  } catch (error) {
    console.log("⚠️ Could not generate previews (this is normal for dry runs)");
  }
}

function extractInnerSvg(svgString: string): string {
  const match = svgString.match(/<svg[^>]*>(.*)<\/svg>/s);
  return match ? match[1] : svgString;
}

function parseBadgeSvg(badgeSvg: string): {
  innerSvg: string;
  width: number;
  height: number;
  translateX: number;
  translateY: number;
} {
  const viewBoxMatch = badgeSvg.match(
    /viewBox="([\d.+-]+)\s+([\d.+-]+)\s+([\d.+-]+)\s+([\d.+-]+)"/
  );
  const widthAttrMatch = badgeSvg.match(/width="([\d.+-]+)(?:px)?"/i);
  const heightAttrMatch = badgeSvg.match(/height="([\d.+-]+)(?:px)?"/i);

  const viewBoxX = viewBoxMatch ? parseFloat(viewBoxMatch[1]) : 0;
  const viewBoxY = viewBoxMatch ? parseFloat(viewBoxMatch[2]) : 0;
  const viewBoxWidth = viewBoxMatch ? parseFloat(viewBoxMatch[3]) : undefined;
  const viewBoxHeight = viewBoxMatch ? parseFloat(viewBoxMatch[4]) : undefined;

  const width = viewBoxWidth
    ? viewBoxWidth
    : widthAttrMatch
    ? parseFloat(widthAttrMatch[1])
    : 64;
  const height = viewBoxHeight
    ? viewBoxHeight
    : heightAttrMatch
    ? parseFloat(heightAttrMatch[1])
    : 64;
  const innerSvg = extractInnerSvg(badgeSvg);
  return {
    innerSvg,
    width,
    height,
    translateX: viewBoxX,
    translateY: viewBoxY,
  };
}

function createFourViewPreview(
  sideViewSvgs: string[],
  itemId: number,
  itemName: string
): string {
  const frontSvg = extractInnerSvg(sideViewSvgs[0]);
  const leftSvg = extractInnerSvg(sideViewSvgs[1]);
  const rightSvg = extractInnerSvg(sideViewSvgs[2]);
  const backSvg = extractInnerSvg(sideViewSvgs[3]);

  // Create a 2x2 grid layout: Front (top-left), Right (top-right), Left (bottom-left), Back (bottom-right)
  const stitchedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <!-- Front View (top-left) -->
  <g transform="translate(0, 0)">
    <g transform="translate(0, 0)">
      ${frontSvg}
    </g>
  </g>
  
  <!-- Right View (top-right) -->
  <g transform="translate(64, 0)">
    <g transform="translate(0, 0)">
      ${rightSvg}
    </g>
  </g>
  
  <!-- Left View (bottom-left) -->
  <g transform="translate(0, 64)">
    <g transform="translate(0, 0)">
      ${leftSvg}
    </g>
  </g>
  
  <!-- Back View (bottom-right) -->
  <g transform="translate(64, 64)">
    <g transform="translate(0, 0)">
      ${backSvg}
    </g>
  </g>
</svg>`;

  return stitchedSvg;
}

function createBadgeGridPreview(badgeIds: number[]): string {
  const columns = 4;
  const cellSize = 80;
  const rows = Math.ceil(badgeIds.length / columns) || 1;

  const badgeGroups = badgeIds
    .map((badgeId, index) => {
      const badgeSvg = getBadgeSvg(badgeId);
      if (!badgeSvg) {
        console.log(`⚠️ Missing badge SVG for ID: ${badgeId}`);
        return "";
      }

      const { innerSvg, width, height, translateX, translateY } =
        parseBadgeSvg(badgeSvg);
      const col = index % columns;
      const row = Math.floor(index / columns);
      const scale = cellSize / Math.max(width, height);

      return `
  <g transform="translate(${col * cellSize}, ${
        row * cellSize
      }) scale(${scale}) translate(${-translateX}, ${-translateY})">
    ${innerSvg}
  </g>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${
    columns * cellSize
  }" height="${rows * cellSize}" viewBox="0 0 ${columns * cellSize} ${
    rows * cellSize
  }">
  ${badgeGroups}
</svg>`;
}

function getSlotPosition(slotPositions: string): number {
  // Map slot names to slot indices based on LibItems constants
  const slotMap: { [key: string]: number } = {
    body: 0,
    face: 1,
    eyes: 2,
    head: 3,
    handLeft: 4,
    hands: 4, // hands maps to left hand
    handRight: 5,
    pet: 6,
    background: 7,
  };

  return slotMap[slotPositions] ?? -1;
}

export async function confirmChecklist(
  itemIds: number[],
  hre: any
): Promise<boolean> {
  console.log("\n🔍 Pre-flight Checklist:");
  console.log(
    "Before proceeding, please confirm you have completed the following:"
  );

  // Step 1: Ask user to confirm they added itemTypes
  const itemTypesAnswer = await askQuestion(
    "✓ Added the itemType definitions to itemTypes.ts (y/n): "
  );
  if (
    itemTypesAnswer.toLowerCase() !== "y" &&
    itemTypesAnswer.toLowerCase() !== "yes"
  ) {
    console.log(
      "❌ Please complete: Added the itemType definitions to itemTypes.ts"
    );
    return false;
  }

  // Step 2: Validate that item types actually exist locally
  console.log("🔍 Validating item types exist in itemTypes.ts...");
  const missingItemTypes: number[] = [];
  const bodyWearablesWithSleeves: number[] = [];

  for (const itemId of itemIds) {
    const itemType = itemTypes[itemId];
    if (!itemType) {
      missingItemTypes.push(itemId);
    } else {
      // Check if it's a body wearable with sleeves
      if (itemType.slotPositions === "body" && itemType.sleeves) {
        bodyWearablesWithSleeves.push(itemId);
      }
    }
  }

  if (missingItemTypes.length > 0) {
    console.log(
      `❌ Missing item types in itemTypes.ts: ${missingItemTypes.join(", ")}`
    );
    console.log("Please add these item types before proceeding.");
    return false;
  }
  console.log("✅ All item types found in itemTypes.ts");

  // Step 2.5: Check if item types are already deployed onchain (to avoid conflicts)
  if (hre) {
    console.log("🔍 Checking if item types are already deployed onchain...");
    const alreadyDeployedItems: number[] = [];

    try {
      const c = await varsForNetwork(hre.ethers);
      const signer = await getRelayerSigner(hre);

      if (hre.network.name === "hardhat" || hre.network.name === "localhost") {
        await mine();
      }

      const itemsFacet = await hre.ethers.getContractAt(
        "ItemsFacet",
        c.aavegotchiDiamond!,
        signer
      );

      for (const itemId of itemIds) {
        try {
          const itemType = await itemsFacet.getItemType(itemId);

          if (itemType && itemType.name) {
            alreadyDeployedItems.push(itemId);
          }
        } catch (error) {
          // Item doesn't exist onchain, which is what we want
          console.log("itemType not found onchain", itemId);
        }
      }

      if (alreadyDeployedItems.length > 0) {
        console.log(
          `⚠️ Item types already exist onchain: ${alreadyDeployedItems.join(
            ", "
          )}`
        );
        const shouldContinue = await askQuestion(
          "These item types are already deployed. Continue anyway? (y/n): "
        );
        if (
          shouldContinue.toLowerCase() !== "y" &&
          shouldContinue.toLowerCase() !== "yes"
        ) {
          console.log("❌ Deployment cancelled to avoid conflicts.");
          return false;
        }
      } else {
        console.log("✅ No item type conflicts found - all items are new");
      }
    } catch (error) {
      console.log(
        "⚠️ Could not check onchain item types (this is normal for dry runs)"
      );
    }
  }

  // Step 3: Ask about SVGs and validate
  const svgsAnswer = await askQuestion(
    "✓ Added the SVGs to the svgs folder (y/n): "
  );
  if (svgsAnswer.toLowerCase() !== "y" && svgsAnswer.toLowerCase() !== "yes") {
    console.log("❌ Please complete: Added the SVGs to the svgs folder");
    return false;
  }

  // Validate SVG files exist (wearables vs badges)
  const badgeIds = itemIds.filter((id) => allBadges.includes(id));
  const wearableIds = itemIds.filter((id) => !allBadges.includes(id));

  if (wearableIds.length > 0) {
    console.log("🔍 Validating wearable SVG files exist...");
    const expectedWearableFiles = getExpectedWearableFilenames(wearableIds);
    const svgValidation = validateSvgFiles(expectedWearableFiles);

    if (svgValidation.missing.length > 0) {
      console.log(`❌ Missing wearable SVG files:`);
      svgValidation.missing.forEach((file) => console.log(`   - ${file}`));
      console.log(
        `\nPlease add these SVG files to ./svgs/svgItems/ before proceeding.`
      );
      return false;
    }

    console.log(
      `✅ All wearable SVG files found (${svgValidation.found.length} files):`
    );
    svgValidation.found.forEach((file) => console.log(`   ✓ ${file}`));
  } else {
    console.log("ℹ️ No wearable SVGs to validate.");
  }

  if (badgeIds.length > 0) {
    console.log("🔍 Validating badge SVG files exist...");
    const missingBadges: number[] = [];
    for (const id of badgeIds) {
      const svg = getBadgeSvg(id);
      if (!svg || svg.length === 0) {
        missingBadges.push(id);
      }
    }
    if (missingBadges.length > 0) {
      console.log(
        `❌ Missing badge SVGs for IDs: ${missingBadges.join(
          ", "
        )}. Ensure SVG files exist in the appropriate svgs/* folders.`
      );
      return false;
    }
    console.log(`✅ All badge SVGs resolved for IDs: ${badgeIds.join(", ")}`);
  }

  // Step 4: Conditionally ask about sleeves if needed
  if (bodyWearablesWithSleeves.length > 0) {
    console.log(
      `\n🔍 Detected body wearables with sleeves: ${bodyWearablesWithSleeves.join(
        ", "
      )}`
    );
    const sleevesAnswer = await askQuestion(
      "✓ Added the sleeve SVGs to the svgs folder (y/n): "
    );
    if (
      sleevesAnswer.toLowerCase() !== "y" &&
      sleevesAnswer.toLowerCase() !== "yes"
    ) {
      console.log(
        "❌ Please complete: Added the sleeve SVGs to the svgs folder"
      );
      return false;
    }

    // Validate sleeve SVG files exist
    console.log("🔍 Validating sleeve SVG files exist...");
    const expectedSleeveFiles = getExpectedSleeveFilenames(itemIds);
    const sleeveValidation = validateSvgFiles(expectedSleeveFiles);

    if (sleeveValidation.missing.length > 0) {
      console.log(`❌ Missing sleeve SVG files:`);
      sleeveValidation.missing.forEach((file) => console.log(`   - ${file}`));
      console.log(
        `\nPlease add these sleeve SVG files to ./svgs/svgItems/ before proceeding.`
      );
      return false;
    }

    console.log(
      `✅ All sleeve SVG files found (${sleeveValidation.found.length} files):`
    );
    sleeveValidation.found.forEach((file) => console.log(`   ✓ ${file}`));
  } else {
    console.log(
      "ℹ️ No sleeve SVGs required (no body wearables with sleeves detected)"
    );
  }

  const finalConfirm = await askQuestion(
    "\n🚀 All checks passed! Proceed with deployment? (y/n): "
  );
  return (
    finalConfirm.toLowerCase() === "y" || finalConfirm.toLowerCase() === "yes"
  );
}

// Separate function for post-deployment onchain verification
export async function verifyDeploymentOnchain(
  itemIds: number[],
  hre: any,
  recipient: string
): Promise<boolean> {
  const shouldVerifyOnchain = await askQuestion(
    "\n🔍 Would you like to verify the data has been successfully uploaded onchain? (y/n): "
  );

  if (
    shouldVerifyOnchain.toLowerCase() !== "y" &&
    shouldVerifyOnchain.toLowerCase() !== "yes"
  ) {
    return true; // User chose not to verify, that's fine
  }

  console.log("\n🔗 Verifying onchain data...");

  // Verify item types
  console.log("🔍 Checking item types onchain...");
  const itemTypeVerification = await verifyItemTypesOnchain(itemIds, hre);
  if (itemTypeVerification.verified.length > 0) {
    console.log(
      `✅ Item types verified onchain: ${itemTypeVerification.verified.join(
        ", "
      )}`
    );
  }
  if (itemTypeVerification.missing.length > 0) {
    console.log(
      `❌ Item types missing onchain: ${itemTypeVerification.missing.join(
        ", "
      )}`
    );
  }

  // Verify wearable SVGs
  console.log("🔍 Checking wearable SVGs onchain...");
  const svgVerification = await verifySvgsOnchain(itemIds, hre);
  if (svgVerification.verified.length > 0) {
    console.log(
      `✅ Wearable SVGs verified onchain: ${svgVerification.verified.join(
        ", "
      )}`
    );
  }
  if (svgVerification.missing.length > 0) {
    console.log(
      `❌ Wearable SVGs missing onchain: ${svgVerification.missing.join(", ")}`
    );
  }

  // Verify sleeve associations (if applicable)
  const bodyWearablesWithSleeves = itemIds.filter((itemId) => {
    const itemType = itemTypes[itemId];
    return itemType && itemType.slotPositions === "body" && itemType.sleeves;
  });

  if (bodyWearablesWithSleeves.length > 0) {
    console.log("🔍 Checking sleeve associations onchain...");
    const sleeveVerification = await verifySleevesAssociationsOnchain(
      itemIds,
      hre
    );
    if (sleeveVerification.verified.length > 0) {
      console.log(
        `✅ Sleeve associations verified onchain: ${sleeveVerification.verified.join(
          ", "
        )}`
      );
    }
    if (sleeveVerification.missing.length > 0) {
      console.log(
        `❌ Sleeve associations missing onchain: ${sleeveVerification.missing.join(
          ", "
        )}`
      );
    }

    // Also verify the actual sleeve SVG data
    console.log("🔍 Checking sleeve SVG data onchain...");
    const sleeveSvgVerification = await verifySleeveSvgsOnchain(itemIds, hre);
    if (sleeveSvgVerification.verified.length > 0) {
      console.log(
        `✅ Sleeve SVG data verified onchain: ${sleeveSvgVerification.verified.join(
          ", "
        )}`
      );
    }
    if (sleeveSvgVerification.missing.length > 0) {
      console.log(
        `❌ Sleeve SVG data missing onchain: ${sleeveSvgVerification.missing.join(
          ", "
        )}`
      );
    }
  }

  // Verify item balances (minted quantities)
  console.log("🔍 Checking item balances in recipient...");
  const balanceVerification = await verifyItemBalances(itemIds, hre, recipient);
  if (balanceVerification.verified.length > 0) {
    console.log(
      `✅ Item balances verified: ${balanceVerification.verified.join(", ")}`
    );
  }
  if (balanceVerification.missing.length > 0) {
    console.log(
      `❌ Item balance mismatches: ${balanceVerification.missing.join(", ")}`
    );
  }

  // Check if all verifications passed
  const allItemTypesVerified = itemTypeVerification.missing.length === 0;
  const allSvgsVerified = svgVerification.missing.length === 0;
  const allBalancesVerified = balanceVerification.missing.length === 0;

  let allSleevesVerified = true;
  if (bodyWearablesWithSleeves.length > 0) {
    const sleeveAssociationsVerified =
      (await verifySleevesAssociationsOnchain(itemIds, hre)).missing.length ===
      0;
    const sleeveSvgsVerified =
      (await verifySleeveSvgsOnchain(itemIds, hre)).missing.length === 0;
    allSleevesVerified = sleeveAssociationsVerified && sleeveSvgsVerified;
  }

  if (
    allItemTypesVerified &&
    allSvgsVerified &&
    allSleevesVerified &&
    allBalancesVerified
  ) {
    console.log("\n✅ All onchain verification checks passed!");

    // Generate preview SVGs
    const shouldGeneratePreviews = await askQuestion(
      "\n🎨 Would you like to generate preview SVGs of Aavegotchis wearing the new wearables? (y/n): "
    );

    if (
      shouldGeneratePreviews.toLowerCase() === "y" ||
      shouldGeneratePreviews.toLowerCase() === "yes"
    ) {
      console.log("\n🎨 Generating wearable previews...");
      await generateWearablePreviews(itemIds, hre);
    }

    return true;
  } else {
    console.log(
      "\n⚠️ Some onchain verifications failed. Please check the deployment."
    );
    return false;
  }
}
