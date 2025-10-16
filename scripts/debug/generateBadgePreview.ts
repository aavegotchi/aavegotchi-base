import * as fs from "fs";
import { badge as getBadgeSvg } from "../../svgs/allBadges";

async function main() {
  const badgeIdsArg = process.env.BADGE_IDS;

  const badgeIds = badgeIdsArg
    ? badgeIdsArg.split(",").map((id) => Number(id.trim()))
    : [
        427, 428, 429, 430, 431, 432, 433, 434, 435, 436, 437, 438, 439, 440,
        441, 442,
      ];

  console.log("Generating previews for badge IDs:", badgeIds.join(", "));

  const previewDir = "./preview";
  if (!fs.existsSync(previewDir)) {
    fs.mkdirSync(previewDir, { recursive: true });
  }

  const columns = 4;
  const cellSize = 120;
  const rows = Math.ceil(badgeIds.length / columns) || 1;

  const badgeGroups = badgeIds
    .map((badgeId, index) => {
      const badgeSvg = getBadgeSvg(badgeId);
      if (!badgeSvg) {
        console.log(`⚠️ Missing badge SVG for ID: ${badgeId}`);
        return "";
      }

      const viewBoxMatch = badgeSvg.match(
        /viewBox="([\d.+-]+)\s+([\d.+-]+)\s+([\d.+-]+)\s+([\d.+-]+)"/
      );
      const widthAttrMatch = badgeSvg.match(/width="([\d.+-]+)(?:px)?"/i);
      const heightAttrMatch = badgeSvg.match(/height="([\d.+-]+)(?:px)?"/i);

      const viewBoxX = viewBoxMatch ? parseFloat(viewBoxMatch[1]) : 0;
      const viewBoxY = viewBoxMatch ? parseFloat(viewBoxMatch[2]) : 0;
      const viewBoxWidth = viewBoxMatch
        ? parseFloat(viewBoxMatch[3])
        : undefined;
      const viewBoxHeight = viewBoxMatch
        ? parseFloat(viewBoxMatch[4])
        : undefined;

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
      const innerMatch = badgeSvg.match(/<svg[^>]*>(.*)<\/svg>/s);
      const innerSvg = innerMatch ? innerMatch[1] : badgeSvg;
      const scale = cellSize / Math.max(width, height);
      const col = index % columns;
      const row = Math.floor(index / columns);

      return `
  <g transform="translate(${col * cellSize}, ${
        row * cellSize
      }) scale(${scale}) translate(${-viewBoxX}, ${-viewBoxY})">
    ${innerSvg}
  </g>`;
    })
    .join("");

  const gridSvg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${
    columns * cellSize
  }" height="${rows * cellSize}" viewBox="0 0 ${columns * cellSize} ${
    rows * cellSize
  }" preserveAspectRatio="xMidYMid meet">
  ${badgeGroups}
</svg>`;

  const filename = `${previewDir}/preview_badges_debug.svg`;
  fs.writeFileSync(filename, gridSvg);
  console.log(`✅ Badge preview saved to ${filename}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
