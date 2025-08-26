import { Signer } from "ethers";
import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import {
  getRelayerSigner,
  xpRelayerAddress,
  propType,
  chainAddressesMap,
} from "../scripts/helperFunctions";
import { generateMerkleTree } from "../scripts/query/getAavegotchisXPData";
import { MerkleDropFacet } from "../typechain";
import { ContractTransaction } from "@ethersproject/contracts";

export interface XpDropArgs {
  proposalIds: string;
}

task("deployXPDrops", "Deploys onchain XP airdrops for a list of proposals")
  .addParam(
    "proposalIds",
    "Hex Identifiers for the proposals gotten from snapshot"
  )

  .setAction(async (taskArgs: XpDropArgs, hre: HardhatRuntimeEnvironment) => {
    const propIds = taskArgs.proposalIds.split(",") as string[];

    for (const propId of propIds) {
      //get root and do file writes
      const { root, prop } = await generateMerkleTree(propId, hre);

      const diamondAddress = chainAddressesMap[8453].aavegotchiDiamond;
      const gameManager = xpRelayerAddress;
      let signer: Signer;
      const testing = ["hardhat", "localhost"].includes(hre.network.name);
      if (testing) {
        await hre.network.provider.request({
          method: "hardhat_impersonateAccount",
          params: [gameManager],
        });
        signer = await hre.ethers.provider.getSigner(gameManager);
        //uses relayer signer since it is a game manager
      } else if (hre.network.name === "matic") {
        const accounts = await hre.ethers.getSigners();
        signer = accounts[0];

        //await getRelayerSigner(hre);
      } else {
        throw Error("Incorrect network selected");
      }

      console.log(
        `Adding Airdrop for ${propType(prop.title)}: ${prop.title}!!!`
      );

      const xpMerkle = (
        await hre.ethers.getContractAt("MerkleDropFacet", diamondAddress)
      ).connect(signer) as MerkleDropFacet;

      const proposalType = propType(prop.title);

      console.log("title:", prop.title);

      const e =
        proposalType === "sigprop" ? 10 : proposalType === "coreprop" ? 20 : 0;

      const tx: ContractTransaction = await xpMerkle.createXPDrop(
        prop.id,
        root,
        e
      );

      console.log("Airdrop added", tx.hash);
    }
  });
