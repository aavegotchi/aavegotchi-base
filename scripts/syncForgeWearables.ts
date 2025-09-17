import { ethers, network } from "hardhat";
import { varsForNetwork } from "../helpers/constants";
import { getLedgerSigner, impersonate } from "./helperFunctions";
import { PC_WALLET } from "./geistBridge/paths";
import { getPrizes } from "./fetchGeodePrizes";

export async function main() {
  const c = await varsForNetwork(ethers);
  let forgeDAOFacet = await ethers.getContractAt(
    "ForgeDAOFacet",
    c.forgeDiamond!
  );
  let itemsFacet = await ethers.getContractAt(
    "ItemsFacet",
    c.aavegotchiDiamond!
  );

  //before block of base wearables
  const consolidatedArray = await getPrizes(
    35046021,
    c,
    forgeDAOFacet,
    itemsFacet
  );

  const testing = ["hardhat", "localhost"].includes(network.name);

  if (testing) {
    forgeDAOFacet = await impersonate(
      PC_WALLET,
      forgeDAOFacet,
      ethers,
      network
    );
    itemsFacet = await impersonate(PC_WALLET, itemsFacet, ethers, network);
  } else if (network.name === "base") {
    const s = await getLedgerSigner(ethers);
    forgeDAOFacet = forgeDAOFacet.connect(s);
    itemsFacet = itemsFacet.connect(s);
  }

  const tx = await forgeDAOFacet.setMultiTierGeodePrizes(
    consolidatedArray[0],
    consolidatedArray[1],
    consolidatedArray[2]
  );
  const receipt = await tx.wait();
  if (!receipt.status) {
    throw Error(`Error with transaction: ${tx.hash}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
