import { ItemTypeInput, itemTypes } from "../data/itemTypes/itemTypes";
import { badge } from "./allBadges";
import { svgMapping } from "./allWearables";

const fs = require("fs");

//Front, Right, Back, Left
type WearableSide = "" | "Right" | "Back" | "Left";

export function outputBadge(svgId: string) {
  return `${svgId}_badge`;
}

// Helper function to get the expected filename for a wearable item
function getWearableFilename(
  itemType: ItemTypeInput,
  side: WearableSide,
  sideMap: any
): string | null {
  const { category, svgId, slotPositions, sleeves } = itemType;
  const name = svgMapping[Number(svgId)] || itemType.name;
  const camelCaseName = toCamelCase(name);

  // Skip badges side views and items side views
  if (side !== "" && category === 1) return null;
  if (category === 2 && side !== "") return null;

  // Handle void case
  if (svgId === 0) {
    return side === "" ? "0_Void" : `0_Void${side}`;
  }

  // Check for exceptions
  const isException = sideMap[side].exceptions.includes(Number(svgId));

  if (isException) {
    return `${svgId}_${camelCaseName}${side}`;
  }

  // Handle body wearables with sleeves
  if (slotPositions === "body" && sleeves) {
    if (name === "Thaave Suit") {
      return `25_ThaaveSuit${side}`;
    }

    if (side === "") {
      return `${svgId}_${camelCaseName}`;
    } else {
      return `${svgId}_${camelCaseName}${side}`;
    }
  } else {
    // Regular wearables
    return side === ""
      ? `${svgId}_${camelCaseName}`
      : `${svgId}_${camelCaseName}${side}`;
  }
}

// Validation function to extract expected filenames without generating SVG content
export function getExpectedWearableFilenames(itemIds: number[]): string[] {
  const filenames: string[] = [];
  const sides: WearableSide[] = ["", "Right", "Back", "Left"];

  for (const itemId of itemIds) {
    const itemType = itemTypes[itemId];
    if (!itemType) continue;

    for (const side of sides) {
      const filename = getWearableFilename(itemType, side, SIDE_CONFIG);
      if (filename) {
        filenames.push(filename);
      }
    }
  }

  return filenames;
}

// Helper function to get expected sleeve filenames for a specific side
function getSleeveFilenamesForSide(
  itemIds: number[],
  side: WearableSide
): string[] {
  const filenames: string[] = [];

  // Define void element mapping (Back side has inconsistent naming)
  const voidElementMap = {
    "": "0_Void",
    Right: "0_VoidRight",
    Back: "0_VoidRight", // Back uses Right void element
    Left: "0_VoidLeft",
  };

  // Hardcoded exceptions that don't use sleeve functions
  const hardcodedExceptions = [25]; // ThaaveSuit

  const voidElement = voidElementMap[side];
  filenames.push(voidElement);

  for (const itemId of itemIds) {
    const itemType = itemTypes.find((item) => item.svgId === itemId);
    if (!itemType || itemType.slotPositions !== "body" || !itemType.sleeves) {
      continue;
    }

    const { svgId } = itemType;
    const name = svgMapping[Number(svgId)] || itemType.name;
    const camelCaseName = toCamelCase(name);

    // Handle hardcoded exceptions
    if (hardcodedExceptions.includes(Number(svgId))) {
      filenames.push(`${svgId}_ThaaveSuit`);
      continue;
    }

    // Generate sleeve filenames based on side
    if (side === "") {
      // Front sleeves: LeftUp, Left, RightUp, Right
      filenames.push(
        `${svgId}_${camelCaseName}LeftUp`,
        `${svgId}_${camelCaseName}Left`,
        `${svgId}_${camelCaseName}RightUp`,
        `${svgId}_${camelCaseName}Right`
      );
    } else if (side === "Left") {
      // Left side sleeves: SideLeftUp, SideLeftDown
      filenames.push(
        `${svgId}_${camelCaseName}SideLeftUp`,
        `${svgId}_${camelCaseName}SideLeftDown`
      );
    } else if (side === "Right") {
      // Right side sleeves: SideRightUp, SideRightDown
      filenames.push(
        `${svgId}_${camelCaseName}SideRightUp`,
        `${svgId}_${camelCaseName}SideRightDown`
      );
    } else if (side === "Back") {
      // Back sleeves: BackLeftUp, BackLeft, BackRightUp, BackRight, plus main Back file
      filenames.push(
        `${svgId}_${camelCaseName}Back`,
        `${svgId}_${camelCaseName}BackLeftUp`,
        `${svgId}_${camelCaseName}BackLeft`,
        `${svgId}_${camelCaseName}BackRightUp`,
        `${svgId}_${camelCaseName}BackRight`
      );
    }
  }

  return filenames;
}

export function getExpectedSleeveFilenames(itemIds: number[]): string[] {
  const allFilenames: string[] = [];
  const sides: WearableSide[] = ["", "Right", "Back", "Left"];

  for (const side of sides) {
    const sideFilenames = getSleeveFilenamesForSide(itemIds, side);
    allFilenames.push(...sideFilenames);
  }

  // Remove duplicates and void elements (we only want the actual sleeve files)
  const uniqueFilenames = [...new Set(allFilenames)].filter(
    (filename) => !filename.includes("Void") && !filename.includes("badge")
  );

  return uniqueFilenames;
}

export function toCamelCase(name: string) {
  const lowercaseWords = new Set(["and", "of", "the"]);
  const compatMap: Record<string, string> = {
    // Historical compatibility with old arrays
    "uGOTCHI Token": "uGOTCHIToken",
  };

  const trimmed = name.trim();
  if (compatMap[trimmed]) return compatMap[trimmed];

  return trimmed
    .split(/[ _]/g)
    .map((segment) => {
      if (!segment) return "";
      // Preserve acronyms/all-caps tokens (ETH, WGMI, H4XX0R)
      if (/^[A-Z0-9]{2,}$/.test(segment)) return segment;
      // Preserve leading-lowercase + caps tokens (uGOTCHI)
      if (/^[a-z][A-Z0-9]{2,}$/.test(segment)) return segment;
      // Preserve existing mixed/PascalCase tokens with an extra uppercase inside (MessDress, AantenaBot)
      if (/[A-Z].*[A-Z]/.test(segment)) return segment;
      // Keep small connector words lowercase (e.g., and, of, the)
      const lower = segment.toLowerCase();
      if (lowercaseWords.has(lower)) return lower;
      // Otherwise TitleCase the segment
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join("")
    .replace(/[’']/g, "");
}

// Shared configuration for wearable sides
const SIDE_CONFIG: Record<
  WearableSide,
  {
    exceptions: number[];
    bodyWearableFunction: (name: string) => string;
  }
> = {
  "": {
    exceptions: [],
    bodyWearableFunction: wearablesWithSleevesFront,
  },
  Right: {
    exceptions: [
      55, 75, 86, 157, 233, 236, 237, 261, 356, 406, 410, 413, 415, 417,
    ],
    bodyWearableFunction: wearableWithSleevesRight,
  },
  Back: {
    exceptions: [
      14, 53, 86, 146, 157, 209, 214, 219, 249, 259, 260, 262, 356, 367, 368,
      378, 381, 382, 384, 385, 405, 409, 412, 416,
    ],
    bodyWearableFunction: wearableWithSleevesBack,
  },
  Left: {
    exceptions: [29, 157],
    bodyWearableFunction: wearableWithSleevesLeft,
  },
};

export function wearableSideSvgs(side: WearableSide) {
  const output = [];

  for (let index = 0; index < itemTypes.length; index++) {
    const itemType = itemTypes[index];
    const { category, svgId, slotPositions, sleeves } = itemType;
    const name = svgMapping[Number(svgId)] || itemType.name;

    if (svgId === 0) {
      output.push(wearable(`0_Void${side}`));
      continue;
    }

    //badges don't have side views
    if (side !== "" && category === 1) {
      output.push(outputBadge(svgId.toString()));
      continue;
    }

    if (category === 1) {
      output.push(badge(Number(svgId)));
      continue;
    }

    //items
    if (category === 2) {
      output.push(wearable(`${svgId}_${toCamelCase(name)}`));
      continue;
    }

    if (SIDE_CONFIG[side].exceptions.includes(Number(svgId))) {
      output.push(`${svgId}_${toCamelCase(name)}${side}`);
      continue;
    }

    if (slotPositions === "body" && sleeves) {
      //add weird exception for thaave suit until we configure the sleeves properly
      if (name === "Thaave Suit") {
        output.push(wearable(`25_ThaaveSuit${side}`));
        continue;
      }

      output.push(
        SIDE_CONFIG[side].bodyWearableFunction(`${svgId}_${toCamelCase(name)}`)
      );
    } else output.push(wearable(`${svgId}_${toCamelCase(name)}${side}`));
  }

  //Validate against old data source
  for (let index = 0; index < output.length; index++) {
    const element = output[index];

    const oldWearableElement = validationArraysMap.wearables[side][index];

    if (element !== oldWearableElement) {
      throw new Error(
        `${side} wearable mismatch at index ${index}: ${element} old element: ${oldWearableElement}`
      );
    }
  }

  return output;
}

export function wearableSideSleeveSvgs(side: WearableSide) {
  const output = [];

  // Define side-specific sleeve functions
  const sleeveFunctionsMap = {
    "": sleevesWearableFront,
    Right: sleeveWearableRight,
    Back: sleeveWearableRight, // Back reuses Right function
    Left: sleeveWearableLeft,
  };

  // Define void element mapping (Back side has inconsistent naming)
  const voidElementMap = {
    "": "0_Void",
    Right: "0_VoidRight",
    Back: "0_VoidRight", // Back uses Right void element
    Left: "0_VoidLeft",
  };

  // Hardcoded exceptions that don't use sleeve functions
  const hardcodedExceptions = [25]; // ThaaveSuit

  const sleeveFunction = sleeveFunctionsMap[side];
  const voidElement = voidElementMap[side];

  // Only process items that have sleeves - this creates a 57-item array
  for (let index = 0; index < itemTypes.length; index++) {
    const { svgId, slotPositions, sleeves } = itemTypes[index];

    const name = svgMapping[Number(svgId)] || itemTypes[index].name;

    // Handle void element (always first)
    if (svgId === 0) {
      output.push(voidElement);
      continue;
    }

    // Only iterate over items that have sleeves (body items with sleeves property)
    if (slotPositions === "body" && sleeves) {
      // Handle hardcoded exceptions
      if (hardcodedExceptions.includes(Number(svgId))) {
        output.push(`${svgId}_ThaaveSuit`);
        continue;
      }

      output.push(sleeveFunction(`${svgId}_${toCamelCase(name)}`));
    }
    // Skip all other items (badges, potions, non-sleeve body items, etc.)
  }

  // Validation against old arrays
  for (let index = 0; index < output.length; index++) {
    const element = output[index];
    const oldSleeveElement = validationArraysMap.sleeves[side][index];

    if (element !== oldSleeveElement) {
      throw new Error(
        `${side} sleeve mismatch at index ${index}: ${element} old element: ${oldSleeveElement}`
      );
    }
  }

  return output;
}

// Backward compatibility exports
export const wearablesFrontSvgs = () => wearableSideSvgs("");
export const wearablesRightSvgs = () => wearableSideSvgs("Right");
export const wearablesBackSvgs = () => wearableSideSvgs("Back");
export const wearablesLeftSvgs = () => wearableSideSvgs("Left");

export const wearablesRightSvgsOld = [
  wearable("0_VoidRight"),
  wearable("1_CamoHatRight"),
  wearable("2_CamoPantsRight"),
  wearable("3_MK2GrenadeRight"),
  wearable("4_SnowCamoHatRight"),
  wearable("5_SnowCamoPantsRight"),
  wearable("6_M67GrenadeRight"),
  wearable("7_MarineCapRight"),
  wearableWithSleevesRight("8_MarineJacket"),
  wearable("9_WalkieTalkieRight"),
  wearable("10_LinkWhiteHatRight"),
  wearableWithSleevesRight("11_MessDress"),
  wearable("12_LinkBubblyRight"),
  wearable("13_SergeyBeardRight"),
  wearable("14_SergeyEyesRight"),
  wearableWithSleevesRight("15_RedPlaid"),
  wearableWithSleevesRight("16_BluePlaid"),
  wearable("17_LinkCubeRight"),
  wearable("18_AaveHeroMaskRight"),
  wearableWithSleevesRight("19_AaveHeroShirt"),
  wearable("20_AavePlushRight"),
  wearable("21_CaptainAaveMaskRight"),
  wearableWithSleevesRight("22_CaptainAaveSuit"),
  wearable("23_CaptainAaveShieldRight"),
  wearable("24_ThaaveHelmetRight"),
  wearable("25_ThaaveSuitRight"),
  wearable("26_ThaaveHammerRight"),
  wearable("27_MarcHairRight"),
  wearableWithSleevesRight("28_MarcOutfit"),
  wearable("29_REKTSignRight"),
  wearable("30_JordanHairRight"),
  wearableWithSleevesRight("31_JordanSuit"),
  wearable("32_AaveFlagRight"),
  wearable("33_StaniHairRight"),
  wearable("34_StaniVestRight"),
  wearable("35_AaveBoatRight"),
  wearable("36_ETHMaxiGlassesRight"),
  wearableWithSleevesRight("37_ETHTShirt"),
  wearable("38_32ETHCoinRight"),
  wearable("39_FoxyMaskRight"),
  wearable("40_FoxyTailRight"),
  wearable("41_TrezorWalletRight"),
  wearable("42_NogaraEagleMaskRight"),
  wearableWithSleevesRight("43_NogaraEagleArmor"),
  wearable("44_DAOEggRight"),
  wearable("45_ApeMaskRight"),
  wearableWithSleevesRight("46_HalfRektShirt"),
  wearable("47_WaifuPillowRight"),
  wearable("48_XibotMohawkRight"),
  wearable("49_CoderdanShadesRight"),
  wearableWithSleevesRight("50_GldnXrossRobe"),
  wearable("51_MudgenDiamondRight"),
  wearable("52_GalaxyBrainRight"),
  wearable("53_AllSeeingEyesRight"),
  wearableWithSleevesRight("54_LlamacornShirt"),
  "55_AagentHeadsetRight",
  wearableWithSleevesRight("56_AagentShirt"),
  wearable("57_AagentShadesRight"),
  wearable("58_AagentPistolRight"),
  wearable("59_AagentFedoraHatRight"),
  wearable("60_WizardHatRight"),
  wearable("61_WizardHatLegendaryRight"),
  wearable("62_WizardHatMythicalRight"),
  wearable("63_WizardHatGodlikeRight"),
  wearable("64_WizardStaffRight"),
  wearable("65_WizardStaffLegendaryRight"),
  wearable("66_FutureWizardVisorRight"),
  wearable("67_FarmerStrawHatRight"),
  wearable("68_FarmerJeansRight"),
  wearable("69_FarmerPitchforkRight"),
  wearable("70_FarmerHandsawRight"),
  wearable("71_SantagotchiHatRight"),
  wearable("72_JaayHairpieceRight"),
  wearable("73_JaayGlassesRight"),
  wearableWithSleevesRight("74_JaayHaoSuit"),
  "75_OKexSignRight",
  wearable("76_BigGHSTTokenRight"),
  wearable("77_BitcoinBeanieRight"),
  wearable("78_SkaterJeansRight"),
  wearable("79_SkateboardRight"),
  wearable("80_SushiHeadbandRight"),
  wearable("81_SushiRobeRight"),
  wearable("82_SushiRollRight"),
  wearable("83_SushiKnifeRight"),
  wearable("84_GentlemanHatRight"),
  wearableWithSleevesRight("85_GentlemanSuit"),
  "86_GentlemanMonocleRight",
  wearable("87_MinerHelmetRight"),
  wearable("88_MinerJeansRight"),
  wearable("89_MinerPickaxeRight"),
  wearable("90_PajamaHatRight"),
  wearableWithSleevesRight("91_PajamaPants"),
  wearable("92_BedtimeMilkRight"),
  wearable("93_FluffyBlanketRight"),
  wearable("94_RunnerSweatbandRight"),
  wearable("95_RunnerShortsRight"),
  wearable("96_WaterBottleRight"),
  wearable("97_PillboxHatRight"),
  wearable("98_LadySkirtRight"),
  wearable("99_LadyParasolRight"),
  wearable("100_LadyClutchRight"),
  wearable("101_WitchHatRight"),
  wearableWithSleevesRight("102_WitchCape"),
  wearable("103_WitchWandRight"),
  wearable("104_PortalMageHelmetRight"),
  wearableWithSleevesRight("105_PortalMageArmor"),
  wearable("106_PortalMageAxeRight"),
  wearable("107_PortalMageBlackAxeRight"),
  wearable("108_RastaDredsRight"),
  wearableWithSleevesRight("109_RastaShirt"),
  wearable("110_JamaicanFlagRight"),
  wearable("111_HazmatHoodRight"),
  wearableWithSleevesRight("112_HazmatSuit"),
  wearable("113_UraniumRodRight"),
  wearableWithSleevesRight("114_RedHawaiianShirt"),
  wearableWithSleevesRight("115_BlueHawaiianShirt"),
  wearable("116_CoconutRight"),
  wearable("117_DealWithItShadesRight"),
  wearable("118_WaterJugRight"),
  wearable("119_BabyBottleRight"),
  wearable("120_MartiniRight"),
  wearable("121_WineBottleRight"),
  wearable("122_MilkshakeRight"),
  wearable("123_AppleJuiceRight"),
  wearable("124_BeerHelmetRight"),
  wearableWithSleevesRight("125_TrackSuit"),
  wearable("126_KinshipPotion"),
  wearable("127_GreaterKinshipPotion"),
  wearable("128_XPPotion"),
  wearable("129_GreaterXPPotion"),
  wearable("130_FireballRight"),
  wearable("131_DragonHornsRight"),
  wearable("132_DragonWingsRight"),
  wearable("133_PointyHornsRight"),
  wearable("134_L2SignRight"),
  wearableWithSleevesRight("135_PolygonShirt"),
  wearable("136_PolygonCapRight"),
  wearable("137_VoteSignRight"),
  wearableWithSleevesRight("138_SnapshotShirt"),
  wearable("139_SnapshotHatRight"),
  wearable("140_ElfEarsRight"),
  wearable("141_GemstoneRingRight"),
  wearable("142_PrincessTiaraRight"),
  wearable("143_GoldNecklaceRight"),
  wearable("144_PrincessHairRight"),
  wearable("145_GodliLocksRight"),
  wearable("146_ImperialMoustacheRight"),
  wearable("147_TinyCrownRight"),
  wearable("148_RoyalScepterRight"),
  wearable("149_RoyalCrownRight"),
  wearableWithSleevesRight("150_RoyalRobes"),
  wearable("151_CommonRoflRight"),
  wearable("152_UncommonRoflRight"),
  wearable("153_RareRoflRight"),
  wearable("154_LegendaryRoflRight"),
  wearable("155_MythicalRoflRight"),
  wearable("156_GodlikeRoflRight"),
  "157_LilPumpGoateeRight",
  wearable("158_LilPumpDrinkRight"),
  wearable("159_LilPumpShadesRight"),
  wearableWithSleevesRight("160_LilPumpThreads"),
  wearable("161_LilPumpDreadsRight"),
  wearableWithSleevesRight("162_MiamiShirt"),
  "163_badge",
  "164_badge",
  "165_badge",
  "166_badge",
  "167_badge",
  "168_badge",
  "169_badge",
  "170_badge",
  "171_badge",
  "172_badge",
  "173_badge",
  "174_badge",
  "175_badge",
  "176_badge",
  "177_badge",
  "178_badge",
  "179_badge",
  "180_badge",
  "181_badge",
  "182_badge",
  "183_badge",
  "184_badge",
  "185_badge",
  "186_badge",
  "187_badge",
  "188_badge",
  "189_badge",
  "190_badge",
  "191_badge",
  "192_badge",
  "193_badge",
  "194_badge",
  "195_badge",
  "196_badge",
  "197_badge",
  "198_badge",
  wearable("199_SteampunkGlassesRight"),
  wearable("200_SteampunkTrousersRight"),
  wearable("201_SteampunkGloveRight"),
  wearable("202_CyberpunkVRRight"),
  wearableWithSleevesRight("203_GamerJacket"),
  wearable("204_CyberpunkControlRight"),
  wearable("205_GotchiMugRight"),
  wearable("206_BikerHelmetRight"),
  wearable("207_BikerJacketRight"),
  wearable("208_AviatorsRight"),
  wearable("209_HorseshoeMustacheRight"),
  wearable("210_H1backgroundRight"),
  wearable("211_GuyFauwkesMaskRight"),
  wearable("212_1337LaptopRight"),
  wearableWithSleevesRight("213_H4xx0rShirt"),
  wearable("214_MatrixEyesRight"),
  wearable("215_CyborgEyeRight"),
  wearable("216_RainbowVomitRight"),
  wearable("217_CyborgGunRight"),
  wearable("218_MohawkRight"),
  wearable("219_MuttonChopsRight"),
  wearableWithSleevesRight("220_PunkShirt"),
  wearable("221_PirateHatRight"),
  wearableWithSleevesRight("222_PirateCoat"),
  wearable("223_HookHandRight"),
  wearable("224_PiratePatchRight"),
  wearable("225_BasketballRight"),
  wearable("226_RedHeadbandRight"),
  wearable("227_MJJerseyRight"),
  wearable("228_10GallonHatRight"),
  wearable("229_LassoRight"),
  wearable("230_WraanglerJeansRight"),
  wearableWithSleevesRight("231_ComfyPoncho"),
  wearable("232_PonchoHoodieRight"),
  "233_UncommonCactiRight",
  wearableWithSleevesRight("234_ShaamanPoncho"),
  wearable("235_ShaamanHoodieRight"),
  "236_BlueCactiRight",
  "237_MythicalCactiRight",
  wearable("238_GodlikeCactiRight"),
  wearable("239_WagieCapRight"),
  wearable("240_HeadphonesRight"),
  wearableWithSleevesRight("241_WGMIShirt"),
  wearable("242_YellowManbunRight"),
  wearable("243_TintedShadesRight"),
  wearableWithSleevesRight("244_VNeckShirt"),
  wearable("245_GeckoHatRight"),
  wearable("246_APYShadesRight"),
  wearable("247_UpArrowRight"),
  wearableWithSleevesRight("248_UpOnlyShirt"),
  wearable("249_CoinGeckoEyesRight"),
  wearableWithSleevesRight("250_CoinGeckoTee"),
  wearable("251_CoinGeckoCandiesRight"),
  wearable("252_AastronautHelmetRight"),
  wearableWithSleevesRight("253_AastronautSuit"),
  wearable("254_uGOTCHITokenRight"),
  wearable("255_LilBubbleHelmetRight"),
  wearableWithSleevesRight("256_LilBubbleSpaceSuit"),
  wearable("257_BitcoinGuitarRight"),
  wearableWithSleevesRight("258_Hanfu"),
  wearable("259_BushyEyebrowsRight"),
  wearable("260_AncientBeardRight"),
  "261_AantenaBotRight",
  wearable("262_RadarEyesRight"),
  wearable("263_SignalHeadsetRight"),
  "264_badge",
  "265_badge",
  "266_badge",
  "267_badge",
  "268_badge",
  "269_badge",
  "270_badge",
  "271_badge",
  "272_badge",
  "273_badge",
  "274_badge",
  "275_badge",
  "276_badge",
  "277_badge",
  "278_badge",
  "279_badge",
  "280_badge",
  "281_badge",
  "282_badge",
  "283_badge",
  "284_badge",
  "285_badge",
  "286_badge",
  "287_badge",
  "288_badge",
  "289_badge",
  "290_badge",
  "291_badge",
  wearable("292_BrunettePonytailRight"),
  wearableWithSleevesRight("293_LeatherTunic"),
  wearable("294_BowandArrowRight"),
  wearable("295_ForkedBeardRight"),
  wearable("296_DoublesidedAxeRight"),
  wearableWithSleevesRight("297_AnimalSkins"),
  wearable("298_HornedHelmetRight"),
  wearable("299_LongbowRight"),
  wearable("300_FeatheredCapRight"),
  wearable("301_AlluringEyesRight"),
  wearable("302_GeishaHeadpieceRight"),
  wearableWithSleevesRight("303_Kimono"),
  wearable("304_PaperFanRight"),
  wearable("305_SusButterflyRight"),
  wearable("306_FlowerStudsRight"),
  wearableWithSleevesRight("307_FairyWings"),
  wearable("308_RedHairRight"),
  wearable("309_CitaadelHelmRight"),
  wearableWithSleevesRight("310_PlateArmor"),
  wearable("311_SpiritSwordRight"),
  wearable("312_PlateShieldRight"),
  wearable("313_KabutoHelmetRight"),
  wearableWithSleevesRight("314_YoroiArmor"),
  wearable("315_HaanzoKatanaRight"),
  "316_badge",
  "317_badge",
  "318_badge",
  "319_badge",
  "320_badge",
  "321_badge",
  "322_badge",
  "323_badge",
  "324_badge",
  "325_badge",
  "326_badge",
  "327_badge",
  "328_badge",
  "329_badge",
  "330_badge",
  "331_badge",
  "332_badge",
  "333_badge",
  "334_badge",
  "335_badge",
  "336_badge",
  "337_badge",
  "338_badge",
  "339_badge",
  "340_badge",
  "341_badge",
  "342_badge",
  "343_badge",
  "344_badge",
  "345_badge",
  "346_badge",
  "347_badge",
  "348_badge",
  "349_badge",
  wearableWithSleevesRight("350_PixelcraftTee"),
  wearable("351_3DGlassesRight"),
  wearable("352_PixelcraftSquareRight"),
  wearable("353_NimbusRight"),
  wearable("354_AlchemicaApronRight"),
  wearable("355_SafetyGlassesRight"),
  "356_BandageRight",
  wearable("357_NailGunRight"),
  wearable("358_FlamingApronRight"),
  wearable("359_ForgeGogglesRight"),
  wearable("360_GeodeSmasherRight"),
  wearable("361_GeoRight"),
  wearableWithSleevesRight("362_FakeShirt"),
  wearable("363_FakeBeretRight"),
  wearable("364_PaintBrushRight"),
  wearable("365_PaintPaletteRight"),
  wearableWithSleevesRight("366_HeavenlyRobes"),
  wearable("367_EyesOfDevotionRight"),
  wearable("368_BeardOfDivinityRight"),
  wearable("369_StaffOfCreationRight"),
  wearable("370_WavyHairRight"),
  wearable("371_PlasticEarringsRight"),
  wearableWithSleevesRight("372_PartyDress"),
  wearableWithSleevesRight("373_Overalls"),
  wearable("374_LensFrensPlantRight"),
  wearable("375_GMSeedsRight"),
  wearable("376_LickBrainRight"),
  wearable("377_LickEyesRight"),
  wearable("378_LickTongueRight"),
  wearable("379_LickTentacleRight"),
  wearable("380_SebastienHairRight"),
  wearable("381_VoxelEyesRight"),
  wearable("382_GOATeeRight"),
  wearableWithSleevesRight("383_SandboxHoodie"),
  wearable("384_FaangsRight"),
  wearable("385_BlockScannersRight"),
  wearable("386_StaffCharmingRight"),
  wearable("387_RoflnogginRight"),
  "388_badge",
  "389_badge",
  "390_badge",
  "391_badge",
  "392_badge",
  "393_badge",
  "394_badge",
  "395_badge",
  "396_badge",
  "397_badge",
  "398_badge",
  "399_badge",
  "400_badge",
  "401_badge",
  "402_badge",
  "403_badge",
  wearable("404_GrannyGlassesRight"),
  wearable("405_FrecklesRight"),
  "406_CommonStohnRight",
  wearable("407_BasedShadesRight"),
  wearable("408_RastaGlassesRight"),
  wearable("409_BracesRight"),
  "410_UncommonStohnRight",
  wearable("411_AlohaFlowersRight"),
  wearable("412_BaableGumRight"),
  "413_RareStohnRight",
  wearable("414_CheapMaskRight"),
  "415_WildFungiRight",
  wearable("416_KawaiiMouthRight"),
  "417_BabyLickyRight",
  wearableWithSleevesRight("418_BasedShirt"),
  wearable("419_BaseAppRight"),
  wearable("420_JessePollakHairRight"),
  wearable("421_BasedBGRight"),
  wearable("422_HyperBasedBGRight"),
  wearable("423_OGBeachBGRight"),
  wearable("424_OGFarmerBGRight"),
  wearable("425_OGVaporwaveBGRight"),
  wearable("426_OGWizardBGRight"),
];

const wearablesBackSvgsOld = [
  wearable("0_VoidBack"),
  wearable("1_CamoHatBack"),
  wearable("2_CamoPantsBack"),
  wearable("3_MK2GrenadeBack"),
  wearable("4_SnowCamoHatBack"),
  wearable("5_SnowCamoPantsBack"),
  wearable("6_M67GrenadeBack"),
  wearable("7_MarineCapBack"),
  wearableWithSleevesBack("8_MarineJacket"),
  wearable("9_WalkieTalkieBack"),
  wearable("10_LinkWhiteHatBack"),
  wearableWithSleevesBack("11_MessDress"),
  wearable("12_LinkBubblyBack"),
  wearable("13_SergeyBeardBack"),
  "14_SergeyEyesBack",
  wearableWithSleevesBack("15_RedPlaid"),
  wearableWithSleevesBack("16_BluePlaid"),
  wearable("17_LinkCubeBack"),
  wearable("18_AaveHeroMaskBack"),
  wearableWithSleevesBack("19_AaveHeroShirt"),
  wearable("20_AavePlushBack"),
  wearable("21_CaptainAaveMaskBack"),
  wearableWithSleevesBack("22_CaptainAaveSuit"),
  wearable("23_CaptainAaveShieldBack"),
  wearable("24_ThaaveHelmetBack"),
  wearable("25_ThaaveSuitBack"),
  wearable("26_ThaaveHammerBack"),
  wearable("27_MarcHairBack"),
  wearableWithSleevesBack("28_MarcOutfit"),
  wearable("29_REKTSignBack"),
  wearable("30_JordanHairBack"),
  wearableWithSleevesBack("31_JordanSuit"),
  wearable("32_AaveFlagBack"),
  wearable("33_StaniHairBack"),
  wearable("34_StaniVestBack"),
  wearable("35_AaveBoatBack"),
  wearable("36_ETHMaxiGlassesBack"),
  wearableWithSleevesBack("37_ETHTShirt"),
  wearable("38_32ETHCoinBack"),
  wearable("39_FoxyMaskBack"),
  wearable("40_FoxyTailBack"),
  wearable("41_TrezorWalletBack"),
  wearable("42_NogaraEagleMaskBack"),
  wearableWithSleevesBack("43_NogaraEagleArmor"),
  wearable("44_DAOEggBack"),
  wearable("45_ApeMaskBack"),
  wearableWithSleevesBack("46_HalfRektShirt"),
  wearable("47_WaifuPillowBack"),
  wearable("48_XibotMohawkBack"),
  wearable("49_CoderdanShadesBack"),
  wearableWithSleevesBack("50_GldnXrossRobe"),
  wearable("51_MudgenDiamondBack"),
  wearable("52_GalaxyBrainBack"),
  "53_AllSeeingEyesBack",
  wearableWithSleevesBack("54_LlamacornShirt"),
  wearable("55_AagentHeadsetBack"),
  wearableWithSleevesBack("56_AagentShirt"),
  wearable("57_AagentShadesBack"),
  wearable("58_AagentPistolBack"),
  wearable("59_AagentFedoraHatBack"),
  wearable("60_WizardHatBack"),
  wearable("61_WizardHatLegendaryBack"),
  wearable("62_WizardHatMythicalBack"),
  wearable("63_WizardHatGodlikeBack"),
  wearable("64_WizardStaffBack"),
  wearable("65_WizardStaffLegendaryBack"),
  wearable("66_FutureWizardVisorBack"),
  wearable("67_FarmerStrawHatBack"),
  wearable("68_FarmerJeansBack"),
  wearable("69_FarmerPitchforkBack"),
  wearable("70_FarmerHandsawBack"),
  wearable("71_SantagotchiHatBack"),
  wearable("72_JaayHairpieceBack"),
  wearable("73_JaayGlassesBack"),
  wearableWithSleevesBack("74_JaayHaoSuit"),
  wearable("75_OKexSignBack"),
  wearable("76_BigGHSTTokenBack"),
  wearable("77_BitcoinBeanieBack"),
  wearable("78_SkaterJeansBack"),
  wearable("79_SkateboardBack"),
  wearable("80_SushiHeadbandBack"),
  wearable("81_SushiRobeBack"),
  wearable("82_SushiRollBack"),
  wearable("83_SushiKnifeBack"),
  wearable("84_GentlemanHatBack"),
  wearableWithSleevesBack("85_GentlemanSuit"),
  "86_GentlemanMonocleBack",
  wearable("87_MinerHelmetBack"),
  wearable("88_MinerJeansBack"),
  wearable("89_MinerPickaxeBack"),
  wearable("90_PajamaHatBack"),
  wearableWithSleevesBack("91_PajamaPants"),
  wearable("92_BedtimeMilkBack"),
  wearable("93_FluffyBlanketBack"),
  wearable("94_RunnerSweatbandBack"),
  wearable("95_RunnerShortsBack"),
  wearable("96_WaterBottleBack"),
  wearable("97_PillboxHatBack"),
  wearable("98_LadySkirtBack"),
  wearable("99_LadyParasolBack"),
  wearable("100_LadyClutchBack"),
  wearable("101_WitchHatBack"),
  wearableWithSleevesBack("102_WitchCape"),
  wearable("103_WitchWandBack"),
  wearable("104_PortalMageHelmetBack"),
  wearableWithSleevesBack("105_PortalMageArmor"),
  wearable("106_PortalMageAxeBack"),
  wearable("107_PortalMageBlackAxeBack"),
  wearable("108_RastaDredsBack"),
  wearableWithSleevesBack("109_RastaShirt"),
  wearable("110_JamaicanFlagBack"),
  wearable("111_HazmatHoodBack"),
  wearableWithSleevesBack("112_HazmatSuit"),
  wearable("113_UraniumRodBack"),
  wearableWithSleevesBack("114_RedHawaiianShirt"),
  wearableWithSleevesBack("115_BlueHawaiianShirt"),
  wearable("116_CoconutBack"),
  wearable("117_DealWithItShadesBack"),
  wearable("118_WaterJugBack"),
  wearable("119_BabyBottleBack"),
  wearable("120_MartiniBack"),
  wearable("121_WineBottleBack"),
  wearable("122_MilkshakeBack"),
  wearable("123_AppleJuiceBack"),
  wearable("124_BeerHelmetBack"),
  wearableWithSleevesBack("125_TrackSuit"),
  wearable("126_KinshipPotion"),
  wearable("127_GreaterKinshipPotion"),
  wearable("128_XPPotion"),
  wearable("129_GreaterXPPotion"),
  wearable("130_FireballBack"),
  wearable("131_DragonHornsBack"),
  wearable("132_DragonWingsBack"),
  wearable("133_PointyHornsBack"),
  wearable("134_L2SignBack"),
  wearableWithSleevesBack("135_PolygonShirt"),
  wearable("136_PolygonCapBack"),
  wearable("137_VoteSignBack"),
  wearableWithSleevesBack("138_SnapshotShirt"),
  wearable("139_SnapshotHatBack"),
  wearable("140_ElfEarsBack"),
  wearable("141_GemstoneRingBack"),
  wearable("142_PrincessTiaraBack"),
  wearable("143_GoldNecklaceBack"),
  wearable("144_PrincessHairBack"),
  wearable("145_GodliLocksBack"),
  "146_ImperialMoustacheBack",
  wearable("147_TinyCrownBack"),
  wearable("148_RoyalScepterBack"),
  wearable("149_RoyalCrownBack"),
  wearableWithSleevesBack("150_RoyalRobes"),
  wearable("151_CommonRoflBack"),
  wearable("152_UncommonRoflBack"),
  wearable("153_RareRoflBack"),
  wearable("154_LegendaryRoflBack"),
  wearable("155_MythicalRoflBack"),
  wearable("156_GodlikeRoflBack"),
  "157_LilPumpGoateeBack",
  wearable("158_LilPumpDrinkBack"),
  wearable("159_LilPumpShadesBack"),
  wearableWithSleevesBack("160_LilPumpThreads"),
  wearable("161_LilPumpDreadsBack"),
  wearableWithSleevesBack("162_MiamiShirt"),
  "163_badge",
  "164_badge",
  "165_badge",
  "166_badge",
  "167_badge",
  "168_badge",
  "169_badge",
  "170_badge",
  "171_badge",
  "172_badge",
  "173_badge",
  "174_badge",
  "175_badge",
  "176_badge",
  "177_badge",
  "178_badge",
  "179_badge",
  "180_badge",
  "181_badge",
  "182_badge",
  "183_badge",
  "184_badge",
  "185_badge",
  "186_badge",
  "187_badge",
  "188_badge",
  "189_badge",
  "190_badge",
  "191_badge",
  "192_badge",
  "193_badge",
  "194_badge",
  "195_badge",
  "196_badge",
  "197_badge",
  "198_badge",
  wearable("199_SteampunkGlassesBack"),
  wearable("200_SteampunkTrousersBack"),
  wearable("201_SteampunkGloveBack"),
  wearable("202_CyberpunkVRBack"),
  wearableWithSleevesBack("203_GamerJacket"),
  wearable("204_CyberpunkControlBack"),
  wearable("205_GotchiMugBack"),
  wearable("206_BikerHelmetBack"),
  wearable("207_BikerJacketBack"),
  wearable("208_AviatorsBack"),
  "209_HorseshoeMustacheBack",
  wearable("210_H1backgroundBack"),
  wearable("211_GuyFauwkesMaskBack"),
  wearable("212_1337LaptopBack"),
  wearableWithSleevesBack("213_H4xx0rShirt"),
  "214_MatrixEyesBack",
  wearable("215_CyborgEyeBack"),
  wearable("216_RainbowVomitBack"),
  wearable("217_CyborgGunBack"),
  wearable("218_MohawkBack"),
  "219_MuttonChopsBack",
  wearableWithSleevesBack("220_PunkShirt"),
  wearable("221_PirateHatBack"),
  wearableWithSleevesBack("222_PirateCoat"),
  wearable("223_HookHandBack"),
  wearable("224_PiratePatchBack"),
  wearable("225_BasketballBack"),
  wearable("226_RedHeadbandBack"),
  wearable("227_MJJerseyBack"),
  wearable("228_10GallonHatBack"),
  wearable("229_LassoBack"),
  wearable("230_WraanglerJeansBack"),
  wearableWithSleevesBack("231_ComfyPoncho"),
  wearable("232_PonchoHoodieBack"),
  wearable("233_UncommonCactiBack"),
  wearableWithSleevesBack("234_ShaamanPoncho"),
  wearable("235_ShaamanHoodieBack"),
  wearable("236_BlueCactiBack"),
  wearable("237_MythicalCactiBack"),
  wearable("238_GodlikeCactiBack"),
  wearable("239_WagieCapBack"),
  wearable("240_HeadphonesBack"),
  wearableWithSleevesBack("241_WGMIShirt"),
  wearable("242_YellowManbunBack"),
  wearable("243_TintedShadesBack"),
  wearableWithSleevesBack("244_VNeckShirt"),
  wearable("245_GeckoHatBack"),
  wearable("246_APYShadesBack"),
  wearable("247_UpArrowBack"),
  wearableWithSleevesBack("248_UpOnlyShirt"),
  "249_CoinGeckoEyesBack",
  wearableWithSleevesBack("250_CoinGeckoTee"),
  wearable("251_CoinGeckoCandiesBack"),
  wearable("252_AastronautHelmetBack"),
  wearableWithSleevesBack("253_AastronautSuit"),
  wearable("254_uGOTCHITokenBack"),
  wearable("255_LilBubbleHelmetBack"),
  wearableWithSleevesBack("256_LilBubbleSpaceSuit"),
  wearable("257_BitcoinGuitarBack"),
  wearableWithSleevesBack("258_Hanfu"),
  "259_BushyEyebrowsBack",
  "260_AncientBeardBack",
  wearable("261_AantenaBotBack"),
  "262_RadarEyesBack",
  wearable("263_SignalHeadsetBack"),
  "264_badge",
  "265_badge",
  "266_badge",
  "267_badge",
  "268_badge",
  "269_badge",
  "270_badge",
  "271_badge",
  "272_badge",
  "273_badge",
  "274_badge",
  "275_badge",
  "276_badge",
  "277_badge",
  "278_badge",
  "279_badge",
  "280_badge",
  "281_badge",
  "282_badge",
  "283_badge",
  "284_badge",
  "285_badge",
  "286_badge",
  "287_badge",
  "288_badge",
  "289_badge",
  "290_badge",
  "291_badge",
  wearable("292_BrunettePonytailBack"),
  wearableWithSleevesBack("293_LeatherTunic"),
  wearable("294_BowandArrowBack"),
  wearable("295_ForkedBeardBack"),
  wearable("296_DoublesidedAxeBack"),
  wearableWithSleevesBack("297_AnimalSkins"),
  wearable("298_HornedHelmetBack"),
  wearable("299_LongbowBack"),
  wearable("300_FeatheredCapBack"),
  wearable("301_AlluringEyesBack"),
  wearable("302_GeishaHeadpieceBack"),
  wearableWithSleevesBack("303_Kimono"),
  wearable("304_PaperFanBack"),
  wearable("305_SusButterflyBack"),
  wearable("306_FlowerStudsBack"),
  wearableWithSleevesBack("307_FairyWings"),
  wearable("308_RedHairBack"),
  wearable("309_CitaadelHelmBack"),
  wearableWithSleevesBack("310_PlateArmor"),
  wearable("311_SpiritSwordBack"),
  wearable("312_PlateShieldBack"),
  wearable("313_KabutoHelmetBack"),
  wearableWithSleevesBack("314_YoroiArmor"),
  wearable("315_HaanzoKatanaBack"),
  "316_badge",
  "317_badge",
  "318_badge",
  "319_badge",
  "320_badge",
  "321_badge",
  "322_badge",
  "323_badge",
  "324_badge",
  "325_badge",
  "326_badge",
  "327_badge",
  "328_badge",
  "329_badge",
  "330_badge",
  "331_badge",
  "332_badge",
  "333_badge",
  "334_badge",
  "335_badge",
  "336_badge",
  "337_badge",
  "338_badge",
  "339_badge",
  "340_badge",
  "341_badge",
  "342_badge",
  "343_badge",
  "344_badge",
  "345_badge",
  "346_badge",
  "347_badge",
  "348_badge",
  "349_badge",
  wearableWithSleevesBack("350_PixelcraftTee"),
  wearable("351_3DGlassesBack"),
  wearable("352_PixelcraftSquareBack"),
  wearable("353_NimbusBack"),
  wearable("354_AlchemicaApronBack"),
  wearable("355_SafetyGlassesBack"),
  "356_BandageBack",
  wearable("357_NailGunBack"),
  wearable("358_FlamingApronBack"),
  wearable("359_ForgeGogglesBack"),
  wearable("360_GeodeSmasherBack"),
  wearable("361_GeoBack"),
  wearableWithSleevesBack("362_FakeShirt"),
  wearable("363_FakeBeretBack"),
  wearable("364_PaintBrushBack"),
  wearable("365_PaintPaletteBack"),
  wearableWithSleevesBack("366_HeavenlyRobes"),
  "367_EyesOfDevotionBack",
  "368_BeardOfDivinityBack",
  wearable("369_StaffOfCreationBack"),
  wearable("370_WavyHairBack"),
  wearable("371_PlasticEarringsBack"),
  wearableWithSleevesBack("372_PartyDress"),
  wearableWithSleevesBack("373_Overalls"),
  wearable("374_LensFrensPlantBack"),
  wearable("375_GMSeedsBack"),
  wearable("376_LickBrainBack"),
  wearable("377_LickEyesBack"),
  "378_LickTongueBack",
  wearable("379_LickTentacleBack"),
  wearable("380_SebastienHairBack"),
  "381_VoxelEyesBack",
  "382_GOATeeBack",
  wearableWithSleevesBack("383_SandboxHoodie"),
  "384_FaangsBack",
  "385_BlockScannersBack",
  wearable("386_StaffCharmingBack"),
  wearable("387_RoflnogginBack"),
  "388_badge",
  "389_badge",
  "390_badge",
  "391_badge",
  "392_badge",
  "393_badge",
  "394_badge",
  "395_badge",
  "396_badge",
  "397_badge",
  "398_badge",
  "399_badge",
  "400_badge",
  "401_badge",
  "402_badge",
  "403_badge",
  wearable("404_GrannyGlassesBack"),
  "405_FrecklesBack",
  wearable("406_CommonStohnBack"),
  wearable("407_BasedShadesBack"),
  wearable("408_RastaGlassesBack"),
  "409_BracesBack",
  wearable("410_UncommonStohnBack"),
  wearable("411_AlohaFlowersBack"),
  "412_BaableGumBack",
  wearable("413_RareStohnBack"),
  wearable("414_CheapMaskBack"),
  wearable("415_WildFungiBack"),
  "416_KawaiiMouthBack",
  wearable("417_BabyLickyBack"),
  wearableWithSleevesBack("418_BasedShirt"),
  wearable("419_BaseAppBack"),
  wearable("420_JessePollakHairBack"),
  wearable("421_BasedBGBack"),
  wearable("422_HyperBasedBGBack"),
  wearable("423_OGBeachBGBack"),
  wearable("424_OGFarmerBGBack"),
  wearable("425_OGVaporwaveBGBack"),
  wearable("426_OGWizardBGBack"),
];

const wearablesLeftSvgsOld = [
  wearable("0_VoidLeft"),
  wearable("1_CamoHatLeft"),
  wearable("2_CamoPantsLeft"),
  wearable("3_MK2GrenadeLeft"),
  wearable("4_SnowCamoHatLeft"),
  wearable("5_SnowCamoPantsLeft"),
  wearable("6_M67GrenadeLeft"),
  wearable("7_MarineCapLeft"),
  wearableWithSleevesLeft("8_MarineJacket"),
  wearable("9_WalkieTalkieLeft"),
  wearable("10_LinkWhiteHatLeft"),
  wearableWithSleevesLeft("11_MessDress"),
  wearable("12_LinkBubblyLeft"),
  wearable("13_SergeyBeardLeft"),
  wearable("14_SergeyEyesLeft"),
  wearableWithSleevesLeft("15_RedPlaid"),
  wearableWithSleevesLeft("16_BluePlaid"),
  wearable("17_LinkCubeLeft"),
  wearable("18_AaveHeroMaskLeft"),
  wearableWithSleevesLeft("19_AaveHeroShirt"),
  wearable("20_AavePlushLeft"),
  wearable("21_CaptainAaveMaskLeft"),
  wearableWithSleevesLeft("22_CaptainAaveSuit"),
  wearable("23_CaptainAaveShieldLeft"),
  wearable("24_ThaaveHelmetLeft"),
  wearable("25_ThaaveSuitLeft"),
  wearable("26_ThaaveHammerLeft"),
  wearable("27_MarcHairLeft"),
  wearableWithSleevesLeft("28_MarcOutfit"),
  "29_REKTSignLeft",
  wearable("30_JordanHairLeft"),
  wearableWithSleevesLeft("31_JordanSuit"),
  wearable("32_AaveFlagLeft"),
  wearable("33_StaniHairLeft"),
  wearable("34_StaniVestLeft"),
  wearable("35_AaveBoatLeft"),
  wearable("36_ETHMaxiGlassesLeft"),
  wearableWithSleevesLeft("37_ETHTShirt"),
  wearable("38_32ETHCoinRight"),
  wearable("39_FoxyMaskLeft"),
  wearable("40_FoxyTailLeft"),
  wearable("41_TrezorWalletLeft"),
  wearable("42_NogaraEagleMaskLeft"),
  wearableWithSleevesLeft("43_NogaraEagleArmor"),
  wearable("44_DAOEggLeft"),
  wearable("45_ApeMaskLeft"),
  wearableWithSleevesLeft("46_HalfRektShirt"),
  wearable("47_WaifuPillowLeft"),
  wearable("48_XibotMohawkLeft"),
  wearable("49_CoderdanShadesLeft"),
  wearableWithSleevesLeft("50_GldnXrossRobe"),
  wearable("51_MudgenDiamondLeft"),
  wearable("52_GalaxyBrainLeft"),
  wearable("53_AllSeeingEyesLeft"),
  wearableWithSleevesLeft("54_LlamacornShirt"),
  wearable("55_AagentHeadsetLeft"),
  wearableWithSleevesLeft("56_AagentShirt"),
  wearable("57_AagentShadesLeft"),
  wearable("58_AagentPistolLeft"),
  wearable("59_AagentFedoraHatLeft"),
  wearable("60_WizardHatLeft"),
  wearable("61_WizardHatLegendaryLeft"),
  wearable("62_WizardHatMythicalLeft"),
  wearable("63_WizardHatGodlikeLeft"),
  wearable("64_WizardStaffLeft"),
  wearable("65_WizardStaffLegendaryLeft"),
  wearable("66_FutureWizardVisorLeft"),
  wearable("67_FarmerStrawHatLeft"),
  wearable("68_FarmerJeansLeft"),
  wearable("69_FarmerPitchforkLeft"),
  wearable("70_FarmerHandsawLeft"),
  wearable("71_SantagotchiHatLeft"),
  wearable("72_JaayHairpieceLeft"),
  wearable("73_JaayGlassesLeft"),
  wearableWithSleevesLeft("74_JaayHaoSuit"),
  wearable("75_OKexSignLeft"),
  wearable("76_BigGHSTTokenLeft"),
  wearable("77_BitcoinBeanieLeft"),
  wearable("78_SkaterJeansLeft"),
  wearable("79_SkateboardLeft"),
  wearable("80_SushiHeadbandLeft"),
  wearable("81_SushiRobeLeft"), // Body but not sleeves
  wearable("82_SushiRollLeft"),
  wearable("83_SushiKnifeLeft"),
  wearable("84_GentlemanHatLeft"),
  wearableWithSleevesLeft("85_GentlemanSuit"),
  wearable("86_GentlemanMonocleLeft"),
  wearable("87_MinerHelmetLeft"),
  wearable("88_MinerJeansLeft"),
  wearable("89_MinerPickaxeLeft"),
  wearable("90_PajamaHatLeft"),
  wearableWithSleevesLeft("91_PajamaPants"),
  wearable("92_BedtimeMilkLeft"),
  wearable("93_FluffyBlanketLeft"),
  wearable("94_RunnerSweatbandLeft"),
  wearable("95_RunnerShortsLeft"),
  wearable("96_WaterBottleLeft"),
  wearable("97_PillboxHatLeft"),
  wearable("98_LadySkirtLeft"),
  wearable("99_LadyParasolLeft"),
  wearable("100_LadyClutchLeft"),
  wearable("101_WitchHatLeft"),
  wearableWithSleevesLeft("102_WitchCape"),
  wearable("103_WitchWandLeft"),
  wearable("104_PortalMageHelmetLeft"),
  wearableWithSleevesLeft("105_PortalMageArmor"),
  wearable("106_PortalMageAxeLeft"),
  wearable("107_PortalMageBlackAxeLeft"),
  wearable("108_RastaDredsLeft"),
  wearableWithSleevesLeft("109_RastaShirt"),
  wearable("110_JamaicanFlagLeft"),
  wearable("111_HazmatHoodLeft"),
  wearableWithSleevesLeft("112_HazmatSuit"),
  wearable("113_UraniumRodLeft"),
  wearableWithSleevesLeft("114_RedHawaiianShirt"),
  wearableWithSleevesLeft("115_BlueHawaiianShirt"),
  wearable("116_CoconutLeft"),
  wearable("117_DealWithItShadesLeft"),
  wearable("118_WaterJugLeft"),
  wearable("119_BabyBottleLeft"),
  wearable("120_MartiniLeft"),
  wearable("121_WineBottleLeft"),
  wearable("122_MilkshakeLeft"),
  wearable("123_AppleJuiceLeft"),
  wearable("124_BeerHelmetLeft"),
  wearableWithSleevesLeft("125_TrackSuit"),
  wearable("126_KinshipPotion"),
  wearable("127_GreaterKinshipPotion"),
  wearable("128_XPPotion"),
  wearable("129_GreaterXPPotion"),
  wearable("130_FireballLeft"),
  wearable("131_DragonHornsLeft"),
  wearable("132_DragonWingsLeft"),
  wearable("133_PointyHornsLeft"),
  wearable("134_L2SignLeft"),
  wearableWithSleevesLeft("135_PolygonShirt"),
  wearable("136_PolygonCapLeft"),
  wearable("137_VoteSignLeft"),
  wearableWithSleevesLeft("138_SnapshotShirt"),
  wearable("139_SnapshotHatLeft"),
  wearable("140_ElfEarsLeft"),
  wearable("141_GemstoneRingLeft"),
  wearable("142_PrincessTiaraLeft"),
  wearable("143_GoldNecklaceLeft"),
  wearable("144_PrincessHairLeft"),
  wearable("145_GodliLocksLeft"),
  wearable("146_ImperialMoustacheLeft"),
  wearable("147_TinyCrownLeft"),
  wearable("148_RoyalScepterLeft"),
  wearable("149_RoyalCrownLeft"),
  wearableWithSleevesLeft("150_RoyalRobes"),
  wearable("151_CommonRoflLeft"),
  wearable("152_UncommonRoflLeft"),
  wearable("153_RareRoflLeft"),
  wearable("154_LegendaryRoflLeft"),
  wearable("155_MythicalRoflLeft"),
  wearable("156_GodlikeRoflLeft"),
  "157_LilPumpGoateeLeft",
  wearable("158_LilPumpDrinkLeft"),
  wearable("159_LilPumpShadesLeft"),
  wearableWithSleevesLeft("160_LilPumpThreads"),
  wearable("161_LilPumpDreadsLeft"),
  wearableWithSleevesLeft("162_MiamiShirt"),
  "163_badge",
  "164_badge",
  "165_badge",
  "166_badge",
  "167_badge",
  "168_badge",
  "169_badge",
  "170_badge",
  "171_badge",
  "172_badge",
  "173_badge",
  "174_badge",
  "175_badge",
  "176_badge",
  "177_badge",
  "178_badge",
  "179_badge",
  "180_badge",
  "181_badge",
  "182_badge",
  "183_badge",
  "184_badge",
  "185_badge",
  "186_badge",
  "187_badge",
  "188_badge",
  "189_badge",
  "190_badge",
  "191_badge",
  "192_badge",
  "193_badge",
  "194_badge",
  "195_badge",
  "196_badge",
  "197_badge",
  "198_badge",
  wearable("199_SteampunkGlassesLeft"),
  wearable("200_SteampunkTrousersLeft"),
  wearable("201_SteampunkGloveLeft"),
  wearable("202_CyberpunkVRLeft"),
  wearableWithSleevesLeft("203_GamerJacket"),
  wearable("204_CyberpunkControlLeft"),
  wearable("205_GotchiMugLeft"),
  wearable("206_BikerHelmetLeft"),
  wearable("207_BikerJacketLeft"),
  wearable("208_AviatorsLeft"),
  wearable("209_HorseshoeMustacheLeft"),
  wearable("210_H1backgroundLeft"),
  wearable("211_GuyFauwkesMaskLeft"),
  wearable("212_1337LaptopLeft"),
  wearableWithSleevesLeft("213_H4xx0rShirt"),
  wearable("214_MatrixEyesLeft"),
  wearable("215_CyborgEyeLeft"),
  wearable("216_RainbowVomitLeft"),
  wearable("217_CyborgGunLeft"),
  wearable("218_MohawkLeft"),
  wearable("219_MuttonChopsLeft"),
  wearableWithSleevesLeft("220_PunkShirt"),
  wearable("221_PirateHatLeft"),
  wearableWithSleevesLeft("222_PirateCoat"),
  wearable("223_HookHandLeft"),
  wearable("224_PiratePatchLeft"),
  wearable("225_BasketballLeft"),
  wearable("226_RedHeadbandLeft"),
  wearable("227_MJJerseyLeft"),
  wearable("228_10GallonHatLeft"),
  wearable("229_LassoLeft"),
  wearable("230_WraanglerJeansLeft"),
  wearableWithSleevesLeft("231_ComfyPoncho"),
  wearable("232_PonchoHoodieLeft"),
  wearable("233_UncommonCactiLeft"),
  wearableWithSleevesLeft("234_ShaamanPoncho"),
  wearable("235_ShaamanHoodieLeft"),
  wearable("236_BlueCactiLeft"),
  wearable("237_MythicalCactiLeft"),
  wearable("238_GodlikeCactiLeft"),
  wearable("239_WagieCapLeft"),
  wearable("240_HeadphonesLeft"),
  wearableWithSleevesLeft("241_WGMIShirt"),
  wearable("242_YellowManbunLeft"),
  wearable("243_TintedShadesLeft"),
  wearableWithSleevesLeft("244_VNeckShirt"),
  wearable("245_GeckoHatLeft"),
  wearable("246_APYShadesLeft"),
  wearable("247_UpArrowLeft"),
  wearableWithSleevesLeft("248_UpOnlyShirt"),
  wearable("249_CoinGeckoEyesLeft"),
  wearableWithSleevesLeft("250_CoinGeckoTee"),
  wearable("251_CoinGeckoCandiesLeft"),
  wearable("252_AastronautHelmetLeft"),
  wearableWithSleevesLeft("253_AastronautSuit"),
  wearable("254_uGOTCHITokenLeft"),
  wearable("255_LilBubbleHelmetLeft"),
  wearableWithSleevesLeft("256_LilBubbleSpaceSuit"),
  wearable("257_BitcoinGuitarLeft"),
  wearableWithSleevesLeft("258_Hanfu"),
  wearable("259_BushyEyebrowsLeft"),
  wearable("260_AncientBeardLeft"),
  wearable("261_AantenaBotLeft"),
  wearable("262_RadarEyesLeft"),
  wearable("263_SignalHeadsetLeft"),
  "264_badge",
  "265_badge",
  "266_badge",
  "267_badge",
  "268_badge",
  "269_badge",
  "270_badge",
  "271_badge",
  "272_badge",
  "273_badge",
  "274_badge",
  "275_badge",
  "276_badge",
  "277_badge",
  "278_badge",
  "279_badge",
  "280_badge",
  "281_badge",
  "282_badge",
  "283_badge",
  "284_badge",
  "285_badge",
  "286_badge",
  "287_badge",
  "288_badge",
  "289_badge",
  "290_badge",
  "291_badge",
  wearable("292_BrunettePonytailLeft"),
  wearableWithSleevesLeft("293_LeatherTunic"),
  wearable("294_BowandArrowLeft"),
  wearable("295_ForkedBeardLeft"),
  wearable("296_DoublesidedAxeLeft"),
  wearableWithSleevesLeft("297_AnimalSkins"),
  wearable("298_HornedHelmetLeft"),
  wearable("299_LongbowLeft"),
  wearable("300_FeatheredCapLeft"),
  wearable("301_AlluringEyesLeft"),
  wearable("302_GeishaHeadpieceLeft"),
  wearableWithSleevesLeft("303_Kimono"),
  wearable("304_PaperFanLeft"),
  wearable("305_SusButterflyLeft"),
  wearable("306_FlowerStudsLeft"),
  wearableWithSleevesLeft("307_FairyWings"),
  wearable("308_RedHairLeft"),
  wearable("309_CitaadelHelmLeft"),
  wearableWithSleevesLeft("310_PlateArmor"),
  wearable("311_SpiritSwordLeft"),
  wearable("312_PlateShieldLeft"),
  wearable("313_KabutoHelmetLeft"),
  wearableWithSleevesLeft("314_YoroiArmor"),
  wearable("315_HaanzoKatanaLeft"),
  "316_badge",
  "317_badge",
  "318_badge",
  "319_badge",
  "320_badge",
  "321_badge",
  "322_badge",
  "323_badge",
  "324_badge",
  "325_badge",
  "326_badge",
  "327_badge",
  "328_badge",
  "329_badge",
  "330_badge",
  "331_badge",
  "332_badge",
  "333_badge",
  "334_badge",
  "335_badge",
  "336_badge",
  "337_badge",
  "338_badge",
  "339_badge",
  "340_badge",
  "341_badge",
  "342_badge",
  "343_badge",
  "344_badge",
  "345_badge",
  "346_badge",
  "347_badge",
  "348_badge",
  "349_badge",
  wearableWithSleevesLeft("350_PixelcraftTee"),
  wearable("351_3DGlassesLeft"),
  wearable("352_PixelcraftSquareLeft"),
  wearable("353_NimbusLeft"),
  wearable("354_AlchemicaApronLeft"),
  wearable("355_SafetyGlassesLeft"),
  wearable("356_BandageLeft"),
  wearable("357_NailGunLeft"),
  wearable("358_FlamingApronLeft"),
  wearable("359_ForgeGogglesLeft"),
  wearable("360_GeodeSmasherLeft"),
  wearable("361_GeoLeft"),
  wearableWithSleevesLeft("362_FakeShirt"),
  wearable("363_FakeBeretLeft"),
  wearable("364_PaintBrushLeft"),
  wearable("365_PaintPaletteLeft"),
  wearableWithSleevesLeft("366_HeavenlyRobes"),
  wearable("367_EyesOfDevotionLeft"),
  wearable("368_BeardOfDivinityLeft"),
  wearable("369_StaffOfCreationLeft"),
  wearable("370_WavyHairLeft"),
  wearable("371_PlasticEarringsLeft"),
  wearableWithSleevesLeft("372_PartyDress"),
  wearableWithSleevesLeft("373_Overalls"),
  wearable("374_LensFrensPlantLeft"),
  wearable("375_GMSeedsLeft"),
  wearable("376_LickBrainLeft"),
  wearable("377_LickEyesLeft"),
  wearable("378_LickTongueLeft"),
  wearable("379_LickTentacleLeft"),
  wearable("380_SebastienHairLeft"),
  wearable("381_VoxelEyesLeft"),
  wearable("382_GOATeeLeft"),
  wearableWithSleevesLeft("383_SandboxHoodie"),
  wearable("384_FaangsLeft"),
  wearable("385_BlockScannersLeft"),
  wearable("386_StaffCharmingLeft"),
  wearable("387_RoflnogginLeft"),
  //szn5 badges
  "388_badge",
  "389_badge",
  "390_badge",
  "391_badge",
  "392_badge",
  "393_badge",
  "394_badge",
  "395_badge",
  "396_badge",
  "397_badge",
  "398_badge",
  "399_badge",
  "400_badge",
  "401_badge",
  "402_badge",
  "403_badge",
  //gotchigang-contest
  wearable("404_GrannyGlassesLeft"),
  wearable("405_FrecklesLeft"),
  wearable("406_CommonStohnLeft"),
  wearable("407_BasedShadesLeft"),
  wearable("408_RastaGlassesLeft"),
  wearable("409_BracesLeft"),
  wearable("410_UncommonStohnLeft"),
  wearable("411_AlohaFlowersLeft"),
  wearable("412_BaableGumLeft"),
  wearable("413_RareStohnLeft"),
  wearable("414_CheapMaskLeft"),
  wearable("415_WildFungiLeft"),
  wearable("416_KawaiiMouthLeft"),
  wearable("417_BabyLickyLeft"),
  wearableWithSleevesLeft("418_BasedShirt"),
  wearable("419_BaseAppLeft"),
  wearable("420_JessePollakHairLeft"),
  wearable("421_BasedBGLeft"),
  wearable("422_HyperBasedBGLeft"),
  wearable("423_OGBeachBGLeft"),
  wearable("424_OGFarmerBGLeft"),
  wearable("425_OGVaporwaveBGLeft"),
  wearable("426_OGWizardBGLeft"),
];

const wearablesFrontSvgsOld = [
  wearablesWithSleevesFront("0_Void"),
  wearable("1_CamoHat"),
  wearable("2_CamoPants"), // body but doesn't have sleeves
  wearable("3_MK2Grenade"),
  wearable("4_SnowCamoHat"),
  wearable("5_SnowCamoPants"), // body but no sleeves
  wearable("6_M67Grenade"),
  wearable("7_MarineCap"),
  wearablesWithSleevesFront("8_MarineJacket"), // bodyWearable("8_MarineJacket"),
  wearable("9_WalkieTalkie"),
  wearable("10_LinkWhiteHat"),
  wearablesWithSleevesFront("11_MessDress"), // bodyWearable("11_MessDress"),
  wearable("12_LinkBubbly"),
  wearable("13_SergeyBeard"),
  wearable("14_SergeyEyes"), // no eyes for  side
  wearablesWithSleevesFront("15_RedPlaid"), // wearablesWithSleevesFront("15_RedPlaid"),
  wearablesWithSleevesFront("16_BluePlaid"), //  wearablesWithSleevesFront("16_BluePlaid"),
  wearable("17_LinkCube"),
  wearable("18_AaveHeroMask"),
  wearablesWithSleevesFront("19_AaveHeroShirt"), // wearablesWithSleevesFront("19_AaveHeroShirt"),
  wearable("20_AavePlush"),
  wearable("21_CaptainAaveMask"),
  wearablesWithSleevesFront("22_CaptainAaveSuit"), // wearablesWithSleevesFront("22_CaptainAaveSuit"),
  wearable("23_CaptainAaveShield"),
  wearable("24_ThaaveHelmet"),
  wearable("25_ThaaveSuit"), // wearablesWithSleevesFront("25_ThaaveSuit"),
  wearable("26_ThaaveHammer"),
  wearable("27_MarcHair"),
  wearablesWithSleevesFront("28_MarcOutfit"), // wearablesWithSleevesFront("28_MarcOutfit"),
  wearable("29_REKTSign"),
  wearable("30_JordanHair"),
  wearablesWithSleevesFront("31_JordanSuit"), // wearablesWithSleevesFront("31_JordanSuit"),
  wearable("32_AaveFlag"),
  wearable("33_StaniHair"),
  wearable("34_StaniVest"), // wearablesWithSleevesFront("34_StaniVest"),
  wearable("35_AaveBoat"),
  wearable("36_ETHMaxiGlasses"),
  wearablesWithSleevesFront("37_ETHTShirt"),
  wearable("38_32ETHCoin"), //may need ETHCoinRight
  wearable("39_FoxyMask"),
  wearable("40_FoxyTail"), // body but no sleeves
  wearable("41_TrezorWallet"),
  wearable("42_NogaraEagleMask"),
  wearablesWithSleevesFront("43_NogaraEagleArmor"),
  wearable("44_DAOEgg"),
  wearable("45_ApeMask"),
  wearablesWithSleevesFront("46_HalfRektShirt"),
  wearable("47_WaifuPillow"),
  wearable("48_XibotMohawk"),
  wearable("49_CoderdanShades"),
  wearablesWithSleevesFront("50_GldnXrossRobe"),
  wearable("51_MudgenDiamond"),
  wearable("52_GalaxyBrain"),
  wearable("53_AllSeeingEyes"),
  wearablesWithSleevesFront("54_LlamacornShirt"),
  wearable("55_AagentHeadset"),
  wearablesWithSleevesFront("56_AagentShirt"),
  wearable("57_AagentShades"),
  wearable("58_AagentPistol"),
  wearable("59_AagentFedoraHat"),
  wearable("60_WizardHat"),
  wearable("61_WizardHatLegendary"),
  wearable("62_WizardHatMythical"),
  wearable("63_WizardHatGodlike"),
  wearable("64_WizardStaff"),
  wearable("65_WizardStaffLegendary"),
  wearable("66_FutureWizardVisor"),
  wearable("67_FarmerStrawHat"),
  wearable("68_FarmerJeans"), // Body but no sleeves
  wearable("69_FarmerPitchfork"),
  wearable("70_FarmerHandsaw"),
  wearable("71_SantagotchiHat"),
  wearable("72_JaayHairpiece"),
  wearable("73_JaayGlasses"),
  wearablesWithSleevesFront("74_JaayHaoSuit"),
  wearable("75_OKexSign"),
  wearable("76_BigGHSTToken"),
  wearable("77_BitcoinBeanie"),
  wearable("78_SkaterJeans"), // Body but no sleeves
  wearable("79_Skateboard"),
  wearable("80_SushiHeadband"),
  wearable("81_SushiRobe"), // Body but not sleeves
  wearable("82_SushiRoll"),
  wearable("83_SushiKnife"),
  wearable("84_GentlemanHat"),
  wearablesWithSleevesFront("85_GentlemanSuit"),
  wearable("86_GentlemanMonocle"),
  wearable("87_MinerHelmet"),
  wearable("88_MinerJeans"), // Body but no sleeves
  wearable("89_MinerPickaxe"),
  wearable("90_PajamaHat"),
  wearablesWithSleevesFront("91_PajamaPants"),
  wearable("92_BedtimeMilk"),
  wearable("93_FluffyBlanket"),
  wearable("94_RunnerSweatband"),
  wearable("95_RunnerShorts"), // Body but no sleeves
  wearable("96_WaterBottle"),
  wearable("97_PillboxHat"),
  wearable("98_LadySkirt"), // Body but no sleeves
  wearable("99_LadyParasol"),
  wearable("100_LadyClutch"),
  wearable("101_WitchHat"),
  wearablesWithSleevesFront("102_WitchCape"),
  wearable("103_WitchWand"),
  wearable("104_PortalMageHelmet"),
  wearablesWithSleevesFront("105_PortalMageArmor"),
  wearable("106_PortalMageAxe"),
  wearable("107_PortalMageBlackAxe"),
  wearable("108_RastaDreds"),
  wearablesWithSleevesFront("109_RastaShirt"),
  wearable("110_JamaicanFlag"),
  wearable("111_HazmatHood"),
  wearablesWithSleevesFront("112_HazmatSuit"),
  wearable("113_UraniumRod"),
  wearablesWithSleevesFront("114_RedHawaiianShirt"),
  wearablesWithSleevesFront("115_BlueHawaiianShirt"),
  wearable("116_Coconut"),
  wearable("117_DealWithItShades"),
  wearable("118_WaterJug"),
  wearable("119_BabyBottle"),
  wearable("120_Martini"),
  wearable("121_WineBottle"),
  wearable("122_Milkshake"),
  wearable("123_AppleJuice"),
  wearable("124_BeerHelmet"),
  wearablesWithSleevesFront("125_TrackSuit"),
  wearable("126_KinshipPotion"),
  wearable("127_GreaterKinshipPotion"),
  wearable("128_XPPotion"),
  wearable("129_GreaterXPPotion"),
  wearable("130_Fireball"),
  wearable("131_DragonHorns"),
  wearable("132_DragonWings"),
  wearable("133_PointyHorns"), // Body wearable but not sleeves
  wearable("134_L2Sign"),
  wearablesWithSleevesFront("135_PolygonShirt"),
  wearable("136_PolygonCap"),
  wearable("137_VoteSign"),
  wearablesWithSleevesFront("138_SnapshotShirt"),
  wearable("139_SnapshotHat"),
  wearable("140_ElfEars"),
  wearable("141_GemstoneRing"),
  wearable("142_PrincessTiara"),
  wearable("143_GoldNecklace"),
  wearable("144_PrincessHair"),
  wearable("145_GodliLocks"),
  wearable("146_ImperialMoustache"),
  wearable("147_TinyCrown"),
  wearable("148_RoyalScepter"),
  wearable("149_RoyalCrown"),
  wearablesWithSleevesFront("150_RoyalRobes"),
  wearable("151_CommonRofl"),
  wearable("152_UncommonRofl"),
  wearable("153_RareRofl"),
  wearable("154_LegendaryRofl"),
  wearable("155_MythicalRofl"),
  wearable("156_GodlikeRofl"),
  wearable("157_LilPumpGoatee"),
  wearable("158_LilPumpDrink"),
  wearable("159_LilPumpShades"),
  wearablesWithSleevesFront("160_LilPumpThreads"),
  wearable("161_LilPumpDreads"),
  wearablesWithSleevesFront("162_MiamiShirt"),
  badge(163),
  badge(164),
  badge(165),
  badge(166),
  badge(167),
  badge(168),
  badge(169),
  badge(170),
  badge(171),
  badge(172),
  badge(173),
  badge(174),
  badge(175),
  badge(176),
  badge(177),
  badge(178),
  badge(179),
  badge(180),
  badge(181),
  badge(182),
  badge(183),
  badge(184),
  badge(185),
  badge(186),
  badge(187),
  badge(188),
  badge(189),
  badge(190),
  badge(191),
  badge(192),
  badge(193),
  badge(194),
  badge(195),
  badge(196),
  badge(197),
  badge(198),
  wearable("199_SteampunkGlasses"),
  wearable("200_SteampunkTrousers"),
  wearable("201_SteampunkGlove"),
  wearable("202_CyberpunkVR"),
  wearablesWithSleevesFront("203_GamerJacket"),
  wearable("204_CyberpunkControl"),
  wearable("205_GotchiMug"),
  wearable("206_BikerHelmet"),
  wearable("207_BikerJacket"),
  wearable("208_Aviators"),
  wearable("209_HorseshoeMustache"),
  wearable("210_H1background"),
  wearable("211_GuyFauwkesMask"),
  wearable("212_1337Laptop"),
  wearablesWithSleevesFront("213_H4xx0rShirt"),
  wearable("214_MatrixEyes"),
  wearable("215_CyborgEye"),
  wearable("216_RainbowVomit"),
  wearable("217_CyborgGun"),
  wearable("218_Mohawk"),
  wearable("219_MuttonChops"),
  wearablesWithSleevesFront("220_PunkShirt"),
  wearable("221_PirateHat"),
  wearablesWithSleevesFront("222_PirateCoat"),
  wearable("223_HookHand"),
  wearable("224_PiratePatch"),
  wearable("225_Basketball"),
  wearable("226_RedHeadband"),
  wearable("227_MJJersey"),
  wearable("228_10GallonHat"),
  wearable("229_Lasso"),
  wearable("230_WraanglerJeans"),
  wearablesWithSleevesFront("231_ComfyPoncho"),
  wearable("232_PonchoHoodie"),
  wearable("233_UncommonCacti"),
  wearablesWithSleevesFront("234_ShaamanPoncho"),
  wearable("235_ShaamanHoodie"),
  wearable("236_BlueCacti"),
  wearable("237_MythicalCacti"),
  wearable("238_GodlikeCacti"),
  wearable("239_WagieCap"),
  wearable("240_Headphones"),
  wearablesWithSleevesFront("241_WGMIShirt"),
  wearable("242_YellowManbun"),
  wearable("243_TintedShades"),
  wearablesWithSleevesFront("244_VNeckShirt"),
  wearable("245_GeckoHat"),
  wearable("246_APYShades"),
  wearable("247_UpArrow"),
  wearablesWithSleevesFront("248_UpOnlyShirt"),
  wearable("249_CoinGeckoEyes"),
  wearablesWithSleevesFront("250_CoinGeckoTee"),
  wearable("251_CoinGeckoCandies"),
  wearable("252_AastronautHelmet"),
  wearablesWithSleevesFront("253_AastronautSuit"),
  wearable("254_uGOTCHIToken"),
  wearable("255_LilBubbleHelmet"),
  wearablesWithSleevesFront("256_LilBubbleSpaceSuit"),
  wearable("257_BitcoinGuitar"),
  wearablesWithSleevesFront("258_Hanfu"),
  wearable("259_BushyEyebrows"),
  wearable("260_AncientBeard"),
  wearable("261_AantenaBot"),
  wearable("262_RadarEyes"),
  wearable("263_SignalHeadset"),
  badge(264), // Aastronaut Crew Member badge
  badge(265),
  badge(266),
  badge(267),
  badge(268),
  badge(269),
  badge(270),
  badge(271),
  badge(272),
  badge(273),
  badge(274),
  badge(275),
  badge(276),
  badge(277),
  badge(278),
  badge(279),
  badge(280),
  badge(281),
  badge(282),
  badge(283),
  badge(284),
  badge(285),
  badge(286),
  badge(287),
  badge(288),
  badge(289),
  badge(290),
  badge(291),
  wearable("292_BrunettePonytail"),
  wearablesWithSleevesFront("293_LeatherTunic"),
  wearable("294_BowandArrow"),
  wearable("295_ForkedBeard"),
  wearable("296_DoublesidedAxe"),
  wearablesWithSleevesFront("297_AnimalSkins"),
  wearable("298_HornedHelmet"),
  wearable("299_Longbow"),
  wearable("300_FeatheredCap"),
  wearable("301_AlluringEyes"),
  wearable("302_GeishaHeadpiece"),
  wearablesWithSleevesFront("303_Kimono"),
  wearable("304_PaperFan"),
  wearable("305_SusButterfly"),
  wearable("306_FlowerStuds"),
  wearablesWithSleevesFront("307_FairyWings"),
  wearable("308_RedHair"),
  wearable("309_CitaadelHelm"),
  wearablesWithSleevesFront("310_PlateArmor"),
  wearable("311_SpiritSword"),
  wearable("312_PlateShield"),
  wearable("313_KabutoHelmet"),
  wearablesWithSleevesFront("314_YoroiArmor"),
  wearable("315_HaanzoKatana"),
  badge(316),
  badge(317),
  badge(318),
  badge(319),
  badge(320),
  badge(321),
  badge(322),
  badge(323),
  badge(324),
  badge(325),
  badge(326),
  badge(327),
  badge(328),
  badge(329),
  badge(330),
  badge(331),
  badge(332),
  badge(333),
  badge(334),
  badge(335),
  badge(336),
  badge(337),
  badge(338),
  badge(339),
  badge(340),
  badge(341),
  badge(342),
  badge(343),
  badge(344),
  badge(345),
  badge(346),
  badge(347),
  badge(348),
  badge(349),
  wearablesWithSleevesFront("350_PixelcraftTee"),
  wearable("351_3DGlasses"),
  wearable("352_PixelcraftSquare"),
  wearable("353_Nimbus"),
  wearable("354_AlchemicaApron"),
  wearable("355_SafetyGlasses"),
  wearable("356_Bandage"),
  wearable("357_NailGun"),
  wearable("358_FlamingApron"),
  wearable("359_ForgeGoggles"),
  wearable("360_GeodeSmasher"),
  wearable("361_Geo"),
  wearablesWithSleevesFront("362_FakeShirt"),
  wearable("363_FakeBeret"),
  wearable("364_PaintBrush"),
  wearable("365_PaintPalette"),
  wearablesWithSleevesFront("366_HeavenlyRobes"),
  wearable("367_EyesOfDevotion"),
  wearable("368_BeardOfDivinity"),
  wearable("369_StaffOfCreation"),
  //forge wearables2
  wearable("370_WavyHair"),
  wearable("371_PlasticEarrings"),
  wearablesWithSleevesFront("372_PartyDress"),
  wearablesWithSleevesFront("373_Overalls"),
  wearable("374_LensFrensPlant"),
  wearable("375_GMSeeds"),
  wearable("376_LickBrain"),
  wearable("377_LickEyes"),
  wearable("378_LickTongue"),
  wearable("379_LickTentacle"),
  wearable("380_SebastienHair"),
  wearable("381_VoxelEyes"),
  wearable("382_GOATee"),
  wearablesWithSleevesFront("383_SandboxHoodie"),
  wearable("384_Faangs"),
  wearable("385_BlockScanners"),
  wearable("386_StaffCharming"),
  wearable("387_Roflnoggin"),
  badge(388),
  badge(389),
  badge(390),
  badge(391),
  badge(392),
  badge(393),
  badge(394),
  badge(395),
  badge(396),
  badge(397),
  badge(398),
  badge(399),
  badge(400),
  badge(401),
  badge(402),
  badge(403),
  //gotchigang-contest
  wearable("404_GrannyGlasses"),
  wearable("405_Freckles"),
  wearable("406_CommonStohn"),
  wearable("407_BasedShades"),
  wearable("408_RastaGlasses"),
  wearable("409_Braces"),
  wearable("410_UncommonStohn"),
  wearable("411_AlohaFlowers"),
  wearable("412_BaableGum"),
  wearable("413_RareStohn"),
  wearable("414_CheapMask"),
  wearable("415_WildFungi"),
  wearable("416_KawaiiMouth"),
  wearable("417_BabyLicky"),

  //base wearables
  wearablesWithSleevesFront("418_BasedShirt"),
  wearable("419_BaseApp"),
  wearable("420_JessePollakHair"),
  wearable("421_BasedBG"),
  wearable("422_HyperBasedBG"),
  wearable("423_OGBeachBG"),
  wearable("424_OGFarmerBG"),
  wearable("425_OGVaporwaveBG"),
  wearable("426_OGWizardBG"),
];

const sleeveFrontSvgsOld = [
  "0_Void",
  sleevesWearableFront("8_MarineJacket"), // sleevesWearableFront("8_MarineJacket"),
  sleevesWearableFront("11_MessDress"), // sleevesWearableFront("11_MessDress"),
  sleevesWearableFront("15_RedPlaid"), // sleevesWearableFront("15_RedPlaid"),
  sleevesWearableFront("16_BluePlaid"), //  sleevesWearableFront("16_BluePlaid"),
  sleevesWearableFront("19_AaveHeroShirt"), // sleevesWearableFront("19_AaveHeroShirt"),
  sleevesWearableFront("22_CaptainAaveSuit"), // sleevesWearableFront("22_CaptainAaveSuit"),
  "25_ThaaveSuit", //no front sleevesWearableFront
  sleevesWearableFront("28_MarcOutfit"), // sleevesWearableFront("28_MarcOutfit"),
  sleevesWearableFront("31_JordanSuit"), // sleevesWearableFront("31_JordanSuit"),
  sleevesWearableFront("37_ETHTShirt"),
  sleevesWearableFront("43_NogaraEagleArmor"),
  sleevesWearableFront("46_HalfRektShirt"),
  sleevesWearableFront("50_GldnXrossRobe"),
  sleevesWearableFront("54_LlamacornShirt"),
  sleevesWearableFront("56_AagentShirt"),
  sleevesWearableFront("74_JaayHaoSuit"),
  sleevesWearableFront("85_GentlemanSuit"),
  sleevesWearableFront("91_PajamaPants"),
  sleevesWearableFront("102_WitchCape"),
  sleevesWearableFront("105_PortalMageArmor"),
  sleevesWearableFront("109_RastaShirt"),
  sleevesWearableFront("112_HazmatSuit"),
  sleevesWearableFront("114_RedHawaiianShirt"),
  sleevesWearableFront("115_BlueHawaiianShirt"),
  sleevesWearableFront("125_TrackSuit"),
  sleevesWearableFront("135_PolygonShirt"),
  sleevesWearableFront("138_SnapshotShirt"),
  sleevesWearableFront("150_RoyalRobes"),
  sleevesWearableFront("160_LilPumpThreads"),
  sleevesWearableFront("162_MiamiShirt"),
  sleevesWearableFront("203_GamerJacket"),
  sleevesWearableFront("213_H4xx0rShirt"),
  sleevesWearableFront("220_PunkShirt"),
  sleevesWearableFront("222_PirateCoat"),
  sleevesWearableFront("231_ComfyPoncho"),
  sleevesWearableFront("234_ShaamanPoncho"),
  sleevesWearableFront("241_WGMIShirt"),
  sleevesWearableFront("244_VNeckShirt"),
  sleevesWearableFront("248_UpOnlyShirt"),
  sleevesWearableFront("250_CoinGeckoTee"),
  sleevesWearableFront("253_AastronautSuit"),
  sleevesWearableFront("256_LilBubbleSpaceSuit"),
  sleevesWearableFront("258_Hanfu"),
  sleevesWearableFront("293_LeatherTunic"),
  sleevesWearableFront("297_AnimalSkins"),
  sleevesWearableFront("303_Kimono"),
  sleevesWearableFront("307_FairyWings"),
  sleevesWearableFront("310_PlateArmor"),
  sleevesWearableFront("314_YoroiArmor"),
  sleevesWearableFront("350_PixelcraftTee"),
  sleevesWearableFront("362_FakeShirt"),
  sleevesWearableFront("366_HeavenlyRobes"),
  sleevesWearableFront("372_PartyDress"),
  sleevesWearableFront("373_Overalls"),
  sleevesWearableFront("383_SandboxHoodie"),
  sleevesWearableFront("418_BasedShirt"),
];

// Store old arrays for validation
const wearablesLeftSleeveSvgsOld = [
  "0_VoidLeft",
  sleeveWearableLeft("8_MarineJacket"), //
  sleeveWearableLeft("11_MessDress"),
  sleeveWearableLeft("15_RedPlaid"),
  sleeveWearableLeft("16_BluePlaid"),
  sleeveWearableLeft("19_AaveHeroShirt"),
  sleeveWearableLeft("22_CaptainAaveSuit"),
  "25_ThaaveSuit",
  sleeveWearableLeft("28_MarcOutfit"),
  sleeveWearableLeft("31_JordanSuit"),
  sleeveWearableLeft("37_ETHTShirt"),
  sleeveWearableLeft("43_NogaraEagleArmor"),
  sleeveWearableLeft("46_HalfRektShirt"),
  sleeveWearableLeft("50_GldnXrossRobe"),
  sleeveWearableLeft("54_LlamacornShirt"),
  sleeveWearableLeft("56_AagentShirt"),
  sleeveWearableLeft("74_JaayHaoSuit"),
  sleeveWearableLeft("85_GentlemanSuit"),
  sleeveWearableLeft("91_PajamaPants"),
  sleeveWearableLeft("102_WitchCape"),
  sleeveWearableLeft("105_PortalMageArmor"),
  sleeveWearableLeft("109_RastaShirt"),
  sleeveWearableLeft("112_HazmatSuit"),
  sleeveWearableLeft("114_RedHawaiianShirt"),
  sleeveWearableLeft("115_BlueHawaiianShirt"),
  sleeveWearableLeft("125_TrackSuit"),
  sleeveWearableLeft("135_PolygonShirt"),
  sleeveWearableLeft("138_SnapshotShirt"),
  sleeveWearableLeft("150_RoyalRobes"),
  sleeveWearableLeft("160_LilPumpThreads"),
  sleeveWearableLeft("162_MiamiShirt"),
  sleeveWearableLeft("203_GamerJacket"),
  sleeveWearableLeft("213_H4xx0rShirt"),
  sleeveWearableLeft("220_PunkShirt"),
  sleeveWearableLeft("222_PirateCoat"),
  sleeveWearableLeft("231_ComfyPoncho"),
  sleeveWearableLeft("234_ShaamanPoncho"),
  sleeveWearableLeft("241_WGMIShirt"),
  sleeveWearableLeft("244_VNeckShirt"),
  sleeveWearableLeft("248_UpOnlyShirt"),
  sleeveWearableLeft("250_CoinGeckoTee"),
  sleeveWearableLeft("253_AastronautSuit"),
  sleeveWearableLeft("256_LilBubbleSpaceSuit"),
  sleeveWearableLeft("258_Hanfu"),
  sleeveWearableLeft("293_LeatherTunic"),
  sleeveWearableLeft("297_AnimalSkins"),
  sleeveWearableLeft("303_Kimono"),
  sleeveWearableLeft("307_FairyWings"),
  sleeveWearableLeft("310_PlateArmor"),
  sleeveWearableLeft("314_YoroiArmor"),
  sleeveWearableLeft("350_PixelcraftTee"),
  sleeveWearableLeft("362_FakeShirt"),
  sleeveWearableLeft("366_HeavenlyRobes"),
  sleeveWearableLeft("372_PartyDress"),
  sleeveWearableLeft("373_Overalls"),
  sleeveWearableLeft("383_SandboxHoodie"),
  sleeveWearableLeft("418_BasedShirt"),
];

const wearablesRightSleeveSvgsOld = [
  "0_VoidRight",
  sleeveWearableRight("8_MarineJacket"),
  sleeveWearableRight("11_MessDress"),
  sleeveWearableRight("15_RedPlaid"),
  sleeveWearableRight("16_BluePlaid"),
  sleeveWearableRight("19_AaveHeroShirt"),
  sleeveWearableRight("22_CaptainAaveSuit"),
  "25_ThaaveSuit",
  sleeveWearableRight("28_MarcOutfit"),
  sleeveWearableRight("31_JordanSuit"),
  sleeveWearableRight("37_ETHTShirt"),
  sleeveWearableRight("43_NogaraEagleArmor"),
  sleeveWearableRight("46_HalfRektShirt"),
  sleeveWearableRight("50_GldnXrossRobe"),
  sleeveWearableRight("54_LlamacornShirt"),
  sleeveWearableRight("56_AagentShirt"),
  sleeveWearableRight("74_JaayHaoSuit"),
  sleeveWearableRight("85_GentlemanSuit"),
  sleeveWearableRight("91_PajamaPants"),
  sleeveWearableRight("102_WitchCape"),
  sleeveWearableRight("105_PortalMageArmor"),
  sleeveWearableRight("109_RastaShirt"),
  sleeveWearableRight("112_HazmatSuit"),
  sleeveWearableRight("114_RedHawaiianShirt"),
  sleeveWearableRight("115_BlueHawaiianShirt"),
  sleeveWearableRight("125_TrackSuit"),
  sleeveWearableRight("135_PolygonShirt"),
  sleeveWearableRight("138_SnapshotShirt"),
  sleeveWearableRight("150_RoyalRobes"),
  sleeveWearableRight("160_LilPumpThreads"),
  sleeveWearableRight("162_MiamiShirt"),
  sleeveWearableRight("203_GamerJacket"),
  sleeveWearableRight("213_H4xx0rShirt"),
  sleeveWearableRight("220_PunkShirt"),
  sleeveWearableRight("222_PirateCoat"),
  sleeveWearableRight("231_ComfyPoncho"),
  sleeveWearableRight("234_ShaamanPoncho"),
  sleeveWearableRight("241_WGMIShirt"),
  sleeveWearableRight("244_VNeckShirt"),
  sleeveWearableRight("248_UpOnlyShirt"),
  sleeveWearableRight("250_CoinGeckoTee"),
  sleeveWearableRight("253_AastronautSuit"),
  sleeveWearableRight("256_LilBubbleSpaceSuit"),
  sleeveWearableRight("258_Hanfu"),
  sleeveWearableRight("293_LeatherTunic"),
  sleeveWearableRight("297_AnimalSkins"),
  sleeveWearableRight("303_Kimono"),
  sleeveWearableRight("307_FairyWings"),
  sleeveWearableRight("310_PlateArmor"),
  sleeveWearableRight("314_YoroiArmor"),
  sleeveWearableRight("350_PixelcraftTee"),
  sleeveWearableRight("362_FakeShirt"),
  sleeveWearableRight("366_HeavenlyRobes"),
  sleeveWearableRight("372_PartyDress"),
  sleeveWearableRight("373_Overalls"),
  sleeveWearableRight("383_SandboxHoodie"),
  sleeveWearableRight("418_BasedShirt"),
];

const wearablesBackSleeveSvgsOld = [
  "0_VoidRight",
  sleeveWearableRight("8_MarineJacket"),
  sleeveWearableRight("11_MessDress"),
  sleeveWearableRight("15_RedPlaid"),
  sleeveWearableRight("16_BluePlaid"),
  sleeveWearableRight("19_AaveHeroShirt"),
  sleeveWearableRight("22_CaptainAaveSuit"),
  "25_ThaaveSuit",
  sleeveWearableRight("28_MarcOutfit"),
  sleeveWearableRight("31_JordanSuit"),
  sleeveWearableRight("37_ETHTShirt"),
  sleeveWearableRight("43_NogaraEagleArmor"),
  sleeveWearableRight("46_HalfRektShirt"),
  sleeveWearableRight("50_GldnXrossRobe"),
  sleeveWearableRight("54_LlamacornShirt"),
  sleeveWearableRight("56_AagentShirt"),
  sleeveWearableRight("74_JaayHaoSuit"),
  sleeveWearableRight("85_GentlemanSuit"),
  sleeveWearableRight("91_PajamaPants"),
  sleeveWearableRight("102_WitchCape"),
  sleeveWearableRight("105_PortalMageArmor"),
  sleeveWearableRight("109_RastaShirt"),
  sleeveWearableRight("112_HazmatSuit"),
  sleeveWearableRight("114_RedHawaiianShirt"),
  sleeveWearableRight("115_BlueHawaiianShirt"),
  sleeveWearableRight("125_TrackSuit"),
  sleeveWearableRight("135_PolygonShirt"),
  sleeveWearableRight("138_SnapshotShirt"),
  sleeveWearableRight("150_RoyalRobes"),
  sleeveWearableRight("160_LilPumpThreads"),
  sleeveWearableRight("162_MiamiShirt"),
  sleeveWearableRight("203_GamerJacket"),
  sleeveWearableRight("213_H4xx0rShirt"),
  sleeveWearableRight("220_PunkShirt"),
  sleeveWearableRight("222_PirateCoat"),
  sleeveWearableRight("231_ComfyPoncho"),
  sleeveWearableRight("234_ShaamanPoncho"),
  sleeveWearableRight("241_WGMIShirt"),
  sleeveWearableRight("244_VNeckShirt"),
  sleeveWearableRight("248_UpOnlyShirt"),
  sleeveWearableRight("250_CoinGeckoTee"),
  sleeveWearableRight("253_AastronautSuit"),
  sleeveWearableRight("256_LilBubbleSpaceSuit"),
  sleeveWearableRight("258_Hanfu"),
  sleeveWearableRight("293_LeatherTunic"),
  sleeveWearableRight("297_AnimalSkins"),
  sleeveWearableRight("303_Kimono"),
  sleeveWearableRight("307_FairyWings"),
  sleeveWearableRight("310_PlateArmor"),
  sleeveWearableRight("314_YoroiArmor"),
  sleeveWearableRight("350_PixelcraftTee"),
  sleeveWearableRight("362_FakeShirt"),
  sleeveWearableRight("366_HeavenlyRobes"),
  sleeveWearableRight("372_PartyDress"),
  sleeveWearableRight("373_Overalls"),
  sleeveWearableRight("383_SandboxHoodie"),
  sleeveWearableRight("418_BasedShirt"),
];

const validationArraysMap = {
  wearables: {
    "": wearablesFrontSvgsOld,
    Right: wearablesRightSvgsOld,
    Back: wearablesBackSvgsOld,
    Left: wearablesLeftSvgsOld,
  },
  sleeves: {
    "": sleeveFrontSvgsOld,
    Right: wearablesRightSleeveSvgsOld,
    Back: wearablesBackSleeveSvgsOld,
    Left: wearablesLeftSleeveSvgsOld,
  },
};

// Backward compatibility exports
export const wearablesFrontSleeveSvgs = wearableSideSleeveSvgs("");
export const wearablesLeftSleeveSvgs = wearableSideSleeveSvgs("Left");
export const wearablesRightSleeveSvgs = wearableSideSleeveSvgs("Right");
export const wearablesBackSleeveSvgs = wearableSideSleeveSvgs("Back");

function stripSvg(svg: string) {
  // removes svg tag
  if (svg.includes("viewBox")) {
    svg = svg.slice(svg.indexOf(">") + 1);
    svg = svg.replace("</svg>", "");
  }
  return svg;
}

function readSvg(name: string) {
  //check if file exists
  if (!fs.existsSync(`./svgs/svgItems/${name}.svg`)) {
    throw new Error(`File ${name}.svg does not exist!`);
  }

  return stripSvg(fs.readFileSync(`./svgs/svgItems/${name}.svg`, "utf8"));
}

function wearable(name: string) {
  const svg = readSvg(name);
  return svg;
}

//front only
function wearablesWithSleevesFront(name: string) {
  let svg = readSvg(name);
  return svg;
}

//apparently also used for back...?
function wearableWithSleevesBack(name: string) {
  let svg = readSvg(name);
  const back = readSvg(`${name}Back`);
  const backLeftSleevesUp =
    '<g class="gotchi-sleeves gotchi-sleeves-left gotchi-sleeves-up">' +
    readSvg(`${name}BackLeftUp`) +
    "</g>";
  const backLeft = readSvg(`${name}BackLeft`);
  const backRightSleevesUp =
    '<g class="gotchi-sleeves gotchi-sleeves-right gotchi-sleeves-up">' +
    readSvg(`${name}BackRightUp`) +
    "</g>";
  const backRight = readSvg(`${name}BackRight`);

  //if the name includes the wearables 102,150,310, render sleeves first
  if (name.includes("102") || name.includes("150") || name.includes("310")) {
    svg =
      "<g>" +
      backLeftSleevesUp +
      backLeft +
      backRightSleevesUp +
      backRight +
      back +
      "</g>";
  } else {
    svg =
      "<g>" +
      back +
      backLeftSleevesUp +
      backLeft +
      backRightSleevesUp +
      backRight +
      "</g>";
  }
  return svg;
}

function wearableWithSleevesLeft(name: string) {
  let svg;
  const left = readSvg(`${name}SideLeft`);
  svg = "<g>" + left + "</g>";
  return svg;
}

function wearableWithSleevesRight(name: string) {
  let svg;
  const right = readSvg(`${name}SideRight`);
  svg = "<g>" + right + "</g>";
  return svg;
}

function sleeveWearableLeft(name: string) {
  let svg;
  const leftSleevesUp =
    '<g class="gotchi-sleeves gotchi-sleeves-left gotchi-sleeves-up">' +
    readSvg(`${name}SideLeftUp`) +
    "</g>";
  const leftSleevesDown =
    '<g class="gotchi-sleeves gotchi-sleeves-left gotchi-sleeves-down">' +
    readSvg(`${name}SideLeftDown`) +
    "</g>";
  svg = "<g>" + leftSleevesUp + leftSleevesDown + "</g>";
  return svg;
}

function sleeveWearableRight(name: string) {
  let svg;
  const rightSleevesUp =
    '<g class="gotchi-sleeves gotchi-sleeves-right gotchi-sleeves-up">' +
    readSvg(`${name}SideRightUp`) +
    "</g>";
  const rightSleevesDown =
    '<g class="gotchi-sleeves gotchi-sleeves-right gotchi-sleeves-down">' +
    readSvg(`${name}SideRightDown`) +
    "</g>";
  svg = "<g>" + rightSleevesUp + rightSleevesDown + "</g>";
  return svg;
}

function sleeveWearableBack(name: string) {
  let svg;
  const backLeftSleevesUp =
    '<g class="gotchi-sleeves gotchi-sleeves-left gotchi-sleeves-up">' +
    readSvg(`${name}BackLeftUp`) +
    "</g>";
  const backLeft = readSvg(`${name}BackLeft`);
  const backRightSleevesUp =
    '<g class="gotchi-sleeves gotchi-sleeves-right gotchi-sleeves-up">' +
    readSvg(`${name}BackRightUp`) +
    "</g>";
  const backRight = readSvg(`${name}BackRight`);
  svg =
    "<g>" +
    backLeftSleevesUp +
    backLeft +
    backRightSleevesUp +
    backRight +
    "</g>";
}

function EmptySvg() {
  return stripSvg(fs.readFileSync(`./svgs/svgItems/EmptyFile.svg`, "utf8"));
}

export function sleevesWearableFront(name: string) {
  const leftSleevesUp =
    '<g class="gotchi-sleeves gotchi-sleeves-left gotchi-sleeves-up">' +
    readSvg(`${name}LeftUp`) +
    "</g>";
  const leftSleeves =
    '<g class="gotchi-sleeves gotchi-sleeves-left gotchi-sleeves-down">' +
    readSvg(`${name}Left`) +
    "</g>";
  const rightSleevesUp =
    '<g class="gotchi-sleeves gotchi-sleeves-right gotchi-sleeves-up">' +
    readSvg(`${name}RightUp`) +
    "</g>";
  const rightSleeves =
    '<g class="gotchi-sleeves gotchi-sleeves-right gotchi-sleeves-down">' +
    readSvg(`${name}Right`) +
    "</g>";
  let svg =
    "<g>" +
    leftSleevesUp +
    leftSleeves +
    rightSleevesUp +
    rightSleeves +
    "</g>";
  return svg;
}
