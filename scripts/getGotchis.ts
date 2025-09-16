import { request, gql } from "graphql-request";
import fs from "fs/promises";
import { itemTypes } from "../data/itemTypes/itemTypes";
import dotenv from "dotenv";

dotenv.config();

interface Aavegotchi {
  id: string;
  collateral: string;
  eyeShape: number;
  eyeColor: number;
  equippedWearables: string[];
}

// Define the GraphQL query
function getQuery(skip: number) {
  const GET_AAVEGOTCHIS = gql`
{
    aavegotchis(
      first: 1000
      skip: ${skip}
      orderBy: gotchiId
      orderDirection: asc
           where: {collateral_not:"0x0000000000000000000000000000000000000000"}
    ) {
      id
      collateral
      eyeShape
      eyeColor
      equippedWearables
    }
  }
`;
  return GET_AAVEGOTCHIS;
}

// Function to fetch Aavegotchis
async function fetchAavegotchis() {
  const endpoint = process.env.SUBGRAPH_CORE_BASE!;
  console.log("Endpoint:", endpoint);
  // Replace with your GraphQL endpoint
  let allAavegotchis: any = [];
  let skip = 0;
  const limit = 1000; // Number of items to fetch per query

  while (true) {
    try {
      const data = await request(endpoint, getQuery(skip), {
        where: {},
        skip,
      });

      // Log the raw response for debugging
      //console.log("Raw response:", data);

      // Check if data.aavegotchis is defined and has items
      if (!data.aavegotchis || data.aavegotchis.length === 0) {
        console.log("No more Aavegotchis found.");
        break; // Break the loop if no more items are returned
      }

      allAavegotchis = allAavegotchis.concat(data.aavegotchis);

      // Log the number of fetched Aavegotchis
      console.log(`Fetched ${allAavegotchis.length} Aavegotchis...`);

      // Break the loop if fewer items are returned than the limit
      if (data.aavegotchis.length < limit) {
        break;
      }

      skip += limit; // Increment skip for the next batch
      console.log(skip);
    } catch (error) {
      console.error("Error fetching Aavegotchis:", error);
      break; // Exit the loop on error
    }
  }

  return allAavegotchis;
}

async function processAavegotchis(aavegotchis: Aavegotchi[]) {
  return aavegotchis.map((aavegotchi) => ({
    id: parseInt(aavegotchi.id),
    collateral: getTokenFromCollats(aavegotchi.collateral),
    attributes: [
      {
        trait_type: "Base Body",
        value: getTokenFromCollats(aavegotchi.collateral),
      },
      ...getEyeTraits(aavegotchi.eyeShape, aavegotchi.eyeColor),
      ...convertArrayToWearableObjects(aavegotchi.equippedWearables),
    ],
  }));
}

const rarityConfig = {
  eyeColorTraitRanges: [0, 2, 10, 25, 75, 90, 98, 100],
  eyeColors: [
    "mythical_low", // 0 - 2
    "rare_low", // 2 - 10
    "uncommon_low", // 10 - 25
    "common", // 25 - 75
    "uncommon_high", // 75 - 90
    "rare_high", // 90 - 98
    "mythical_high", // 98 - 100
  ],
};

function classifyRarityEyeShapes(value: number): string {
  // Classify based on the provided ranges
  if (value === 0) return "mythic_low_1";
  if (value === 1) return "mythic_low_2";
  if (value >= 90 && value <= 92) return "rare_high_1";
  if (value >= 93 && value <= 94) return "rare_high_2";
  if (value >= 95 && value <= 97) return "rare_high_3";
  if (value >= 75 && value <= 79) return "uncommon_high_1";
  if (value >= 80 && value <= 84) return "uncommon_high_2";
  if (value >= 85 && value <= 89) return "uncommon_high_3";
  if (value >= 25 && value <= 41) return "common_1";
  if (value >= 42 && value <= 57) return "common_2";
  if (value >= 58 && value <= 74) return "common_3";
  if (value >= 10 && value <= 14) return "uncommon_low_1";
  if (value >= 15 && value <= 19) return "uncommon_low_2";
  if (value >= 20 && value <= 24) return "uncommon_low_3";
  if (value >= 2 && value <= 4) return "rare_low_1";
  if (value >= 5 && value <= 6) return "rare_low_2";
  if (value >= 7 && value <= 9) return "rare_low_3";
  if (value === 98 || value === 99) return "mythic_high"; // Include 98 and 99 for mythic_high

  // If the value does not match any criteria, return a default value
  return "value out of range";
}

// Modular function to classify rarity
function classifyRarity(value: number, config = rarityConfig): string {
  // Check for values less than 0
  if (value < 0) {
    return "mythical_low";
  }

  // Check for values greater than 100
  if (value > 100) {
    return "mythical_high";
  }

  // Check the value against the ranges
  for (let i = 0; i < config.eyeColorTraitRanges.length - 1; i++) {
    if (
      value >= config.eyeColorTraitRanges[i] &&
      value < config.eyeColorTraitRanges[i + 1]
    ) {
      return config.eyeColors[i];
    }
  }

  // If the value is out of bounds (should not happen due to previous checks)
  return "value out of range";
}

function getItemNameById(id: number) {
  const item = itemTypes.find((item) => item.svgId === id);

  return item ? item.name : null; // Return the name or null if not found
}

function convertArrayToWearableObjects(arr: string[]) {
  const t = arr.map((item) => parseInt(item, 10));
  const traits = [
    "Wearable (Body)",
    "Wearable (Face)",
    "Wearable (Eyes)",
    "Wearable (Head)",
    "Wearable (Hands)",
    "Wearable (Hands)",
    "Wearable (Pet)",
  ];

  return t
    .map((count, index) => {
      if (count > 0 && index < traits.length) {
        const wearable = getItemNameById(count); // Get the wearable from itemTypes, adding 1 to index
        return {
          trait_type: traits[index],
          value: wearable, // Use the name from itemTypes
        };
      }
      return null; // Skip if count is 0
    })
    .filter((item) => item !== null); // Remove null values
}

function getEyeTraits(
  eyeShapeValue: number,
  eyeColorValue: number
): { trait_type: string; value: string }[] {
  return [
    {
      trait_type: "Eye Shape",
      value: classifyRarityEyeShapes(eyeShapeValue), // Classify rarity for eye shape
    },
    {
      trait_type: "Eye Color",
      value: classifyRarity(eyeColorValue), // Classify rarity for eye color
    },
  ];
}

const collats: { [key: string]: string } = {
  "0xe0b22e0037b130a9f56bbb537684e6fa18192341": "aDAI",
  "0x20d3922b4a1a8560e1ac99fba4fade0c849e2142": "aWETH",
  "0x823cd4264c1b951c9209ad0deaea9988fe8429bf": "aAAVE",
  "0x98ea609569bd25119707451ef982b90e3eb719cd": "aLINK",
  "0xdae5f1590db13e3b40423b5b5c5fbf175515910b": "aUSDT",
  "0x9719d867a500ef117cc201206b8ab51e794d3f82": "aUSDC",
  "0xf4b8888427b00d7caf21654408b7cba2ecf4ebd9": "aTUSD",
  "0x8c8bdbe9cee455732525086264a4bf9cf821c498": "aUNI",
  "0xe20f7d1f0ec39c4d5db01f53554f2ef54c71f613": "aYFI",
  "0x27f8d03b3a2196956ed754badc28d73be8830a6e": "amDAI",
  "0x28424507fefb6f7f8e9d3860f56504e4e5f5f390": "amWETH",
  "0x1d2a0e5ec8e5bbdca5cb219e649b565d8e5c3360": "amAAVE",
  "0x60d55f02a771d515e077c9c2403a1ef324885cec": "amUSDT",
  "0x1a13f4ca1d028320a707d99520abfefca3998b7f": "amUSDC",
  "0x5c2ed810328349100a66b82b78a1791b101c9d61": "amWBTC",
  "0x8df3aad3a84da6b69a4da8aec3ea40d9091b2ac4": "amWMATIC",
};

function getTokenFromCollats(address: string): string {
  return collats[address.toLowerCase()] || "Not Found";
}

// Main function to orchestrate fetching and processing
async function main() {
  const aavegotchis = await fetchAavegotchis();
  const processedAavegotchis = await processAavegotchis(aavegotchis);

  // Write all processed Aavegotchis to a file
  await fs.writeFile(
    "processedAavegotchis.json",
    JSON.stringify(processedAavegotchis, null, 2)
  );

  if (aavegotchis && aavegotchis.length > 0) {
    console.log("Processed Aavegotchis saved to processedAavegotchis.json");
  }
}

// Execute the main function
main();
