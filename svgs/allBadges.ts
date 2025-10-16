import assert from "assert";
import {
  aastronautMemberBadgeId,
  aastronautMemberBadgeSvg,
  coindeskConsensus,
  coindeskConsensusSvg,
  pumpkinBadgeIds,
  pumpkinBadgeSvgs,
  szn1BadgeIds,
  szn1BadgeSvgs,
  szn2BadgeIds,
  szn2BadgeSvgs,
  szn3BadgeIds,
  szn3BadgeSvgs,
  szn4BadgeIds,
  szn4BadgeSvgs,
  szn5BadgeIds,
  szn5BadgeSvgs,
  szn6BadgeIds,
  szn6BadgeSvgs,
  szn7BadgeIds,
  szn7BadgeSvgs,
  szn8BadgeIds,
  szn8BadgeSvgs,
  szn9BadgeIds,
  szn9BadgeSvgs,
  szn10BadgeIds,
  szn10BadgeSvgs,
  tooorkeyBadgeIds,
  tooorkeyBadgeSvgs,
  uniclyBaadgeId,
  uniclyBaadgeSvg,
} from "./BadgeData";

const fs = require("fs");
const BaadgeSvgMap = new Map<number, string>();

//create a number to svg map

export function badge(id: number) {
  readBadgesBatch("svgItems", coindeskConsensusSvg, coindeskConsensus);
  readBadgesBatch("svgItems", uniclyBaadgeSvg, uniclyBaadgeId);
  readBadgesBatch(
    "svgItems",
    aastronautMemberBadgeSvg,
    aastronautMemberBadgeId
  );
  readBadgesBatch("svgItems", szn1BadgeSvgs, szn1BadgeIds);
  readBadgesBatch("baadges", tooorkeyBadgeSvgs, tooorkeyBadgeIds);
  readBadgesBatch("pumpkinBadge", pumpkinBadgeSvgs, pumpkinBadgeIds);
  readBadgesBatch("baadges", szn2BadgeSvgs, szn2BadgeIds);
  readBadgesBatch("sZN3Baadges", szn3BadgeSvgs, szn3BadgeIds);
  readBadgesBatch("sZN4Baadges", szn4BadgeSvgs, szn4BadgeIds);
  readBadgesBatch("sZN5Baadges", szn5BadgeSvgs, szn5BadgeIds);
  readBadgesBatch("sZN6Baadges", szn6BadgeSvgs, szn6BadgeIds);
  readBadgesBatch("sZN7Baadges", szn7BadgeSvgs, szn7BadgeIds);
  readBadgesBatch("sZN8Baadges", szn8BadgeSvgs, szn8BadgeIds);
  readBadgesBatch("sZN9Baadges", szn9BadgeSvgs, szn9BadgeIds);
  readBadgesBatch("sZN10Baadges", szn10BadgeSvgs, szn10BadgeIds);
  //import and add new badges here

  const svg = BaadgeSvgMap.get(id);
  if (svg === undefined) {
    console.error("svg not found for id: ", id);
  }
  return svg!;
}

export function stripSvg(svg: string) {
  // removes svg tag
  if (svg.includes("viewBox")) {
    svg = svg.slice(svg.indexOf(">") + 1);
    svg = svg.replace("</svg>", "");
  }
  return svg;
}

export function readSvg(name: string, folder: string) {
  //folder is usually svgItems but could also be svgItems/subfolder
  let svg;
  try {
    svg = fs.readFileSync(`./svgs/${folder}/${name}.svg`, "utf8");
  } catch (error) {
    console.error(error);
  }
  return stripSvg(svg);
}

function readBadgesBatch(folder: string, names: string[], svgIds: number[]) {
  assert(
    names.length === svgIds.length,
    "names and svgIds must be the same length"
  );
  for (let i = 0; i < names.length; i++) {
    BaadgeSvgMap.set(svgIds[i], readSvg(names[i], folder));
  }
}
