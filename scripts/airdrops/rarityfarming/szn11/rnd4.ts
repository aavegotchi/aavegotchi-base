import { run } from "hardhat";
import { RarityPayoutTaskArgs } from "../../../../tasks/rarityPayouts";

async function rarityPayout() {
  const args: RarityPayoutTaskArgs = {
    season: "11",
    rarityDataFile: "rnd4",
    rounds: "4",
    totalAmount: "1200000",
    blockNumber: "37089750",
    deployerAddress: "0xf52398257A254D541F392667600901f710a006eD",
    blockTimestamp: "1760968847",
    tieBreakerIndex: "3",
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
