import { itemTypes } from "../data/itemTypes/itemTypes";
import {
  getExpectedWearableFilenames,
  getExpectedSleeveFilenames,
} from "../svgs/wearables-sides";
import * as readline from "readline";
import * as fs from "fs";

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

export async function confirmChecklist(itemIds: number[]): Promise<boolean> {
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

  // Step 2: Validate that item types actually exist
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

  // Step 3: Ask about SVGs and validate
  const svgsAnswer = await askQuestion(
    "✓ Added the SVGs to the svgs folder (y/n): "
  );
  if (svgsAnswer.toLowerCase() !== "y" && svgsAnswer.toLowerCase() !== "yes") {
    console.log("❌ Please complete: Added the SVGs to the svgs folder");
    return false;
  }

  // Validate SVG files exist
  console.log("🔍 Validating wearable SVG files exist...");
  const expectedWearableFiles = getExpectedWearableFilenames(itemIds);
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
