import { run } from "hardhat";
import { RarityPayoutTaskArgs } from "../../../../tasks/rarityPayouts";

async function rarityPayout() {
  const args: RarityPayoutTaskArgs = {
    season: "12",
    rarityDataFile: "rnd1",
    rounds: "4",
    totalAmount: "1200000",
    blockNumber: "37694538",
    blockTimestamp: "1762178423",
    deployerAddress: "0xf52398257A254D541F392667600901f710a006eD",
    tieBreakerIndex: "0",
    rarityParams: [750000.0, 7500, 0.94].toString(),
    kinshipParams: [300000.0, 7500, 0.76].toString(),
    xpParams: [150000.0, 7500, 0.65].toString(),
    confirmSend: true,
  };
  await run("rarityPayout", args);
}

rarityPayout()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

exports.rarityPayout = rarityPayout;
