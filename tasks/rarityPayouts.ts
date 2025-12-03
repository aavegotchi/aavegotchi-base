import { task } from "hardhat/config";
import { ContractReceipt } from "@ethersproject/contracts";
import { Signer } from "@ethersproject/abstract-signer";
import { BigNumber } from "@ethersproject/bignumber";
import { parseEther, formatEther } from "@ethersproject/units";
import { ERC20, EscrowFacet } from "../typechain";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import {
  getRelayerSigner,
  baseDiamondAddress,
} from "../scripts/helperFunctions";
import { LeaderboardDataName, LeaderboardType } from "../types";
import {
  stripGotchis,
  confirmCorrectness,
  fetchAndSortLeaderboard,
  fetchSacrificedGotchis,
} from "../scripts/raritySortHelpers";

import { RarityFarmingData, rarityRewards } from "../types";
import { generateSeasonRewards } from "../scripts/generateRewards";
import { ghstAddressBase } from "../helpers/constants";
import { mine } from "@nomicfoundation/hardhat-network-helpers";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

export let tiebreakerIndex: string;

function addCommas(nStr: string) {
  nStr += "";
  const x = nStr.split(".");
  let x1 = x[0];
  const x2 = x.length > 1 ? "." + x[1] : "";
  var rgx = /(\d+)(\d{3})/;
  while (rgx.test(x1)) {
    x1 = x1.replace(rgx, "$1" + "," + "$2");
  }
  return x1 + x2;
}

function strDisplay(str: string) {
  return addCommas(str.toString());
}

export interface RarityPayoutTaskArgs {
  rarityDataFile: string;
  season: string;
  rounds: string;
  totalAmount: string;
  blockNumber: string;
  blockTimestamp: string;
  tieBreakerIndex: string;
  deployerAddress: string;
  rarityParams: string;
  kinshipParams: string;
  xpParams: string;
  confirmSend?: boolean;
}

interface TxArgs {
  tokenID: string;
  amount: Number;
  parsedAmount: string;
}

interface GotchiReward {
  gotchiId: string;
  amount: string;
  parsedAmount: string;
}

interface BatchProgress {
  batchIndex: number;
  transactionHash: string;
  // Optional until confirmed
  blockNumber?: number;
  timestamp: string;
  // Optional until confirmed
  gasUsed?: string;
  gotchiRewards: GotchiReward[];
  totalAmount: string;
  chainId: number;
  status: "pending" | "confirmed" | "failed";
}

interface ProgressFile {
  season: string;
  round: string;
  chainId: number;
  totalBatches: number;
  completedBatches: BatchProgress[];
  completedGotchiIds: Set<string>;
}
task("rarityPayout")
  .addParam("season")
  .addParam(
    "rarityDataFile",
    "File that contains all the data related to the particular rarity round"
  )
  .addParam("deployerAddress")
  .addParam("tieBreakerIndex", "The Tiebreaker index")
  .addFlag("confirmSend", "Actually send GHST instead of dry-run")
  .setAction(
    async (taskArgs: RarityPayoutTaskArgs, hre: HardhatRuntimeEnvironment) => {
      const filename: string = taskArgs.rarityDataFile;
      const deployerAddress = taskArgs.deployerAddress;

      const blockNumber = taskArgs.blockNumber;
      const tieBreakerIndex = taskArgs.tieBreakerIndex;
      const blockTimestamp = taskArgs.blockTimestamp;

      if (blockNumber === "") {
        throw new Error("Block number is not set");
      }

      if (tieBreakerIndex === "") {
        throw new Error("Tiebreaker index is not set");
      }

      const rarityParams = taskArgs.rarityParams.split(",");
      const kinshipParams = taskArgs.kinshipParams.split(",");
      const xpParams = taskArgs.xpParams.split(",");

      const rounds = Number(taskArgs.rounds);

      const rarityRoundRewards = generateSeasonRewards(
        "rarity",
        Number(rarityParams[0]), //total amount
        Number(rarityParams[1]), //num winners
        Number(rarityParams[2]) //y value
      );

      // check that the total amounts for the three leaderboards add up to the total amount for the round

      const individualRoundAmount =
        Number(rarityParams[0]) +
        Number(kinshipParams[0]) +
        Number(xpParams[0]);

      if (individualRoundAmount !== Number(taskArgs.totalAmount)) {
        throw new Error(
          "Total amount for the round does not match the sum of the individual leaderboard amounts"
        );
      }

      const kinshipRoundRewards = generateSeasonRewards(
        "kinship",
        Number(kinshipParams[0]), //total amount
        Number(kinshipParams[1]), //num winners
        Number(kinshipParams[2]) //y value
      );

      const xpRoundRewards = generateSeasonRewards(
        "xp",
        Number(xpParams[0]), //total amount
        Number(xpParams[1]), //num winners
        Number(xpParams[2]) //y value
      );

      console.log("deployer:", deployerAddress);
      // const accounts = await hre.ethers.getSigners(;
      tiebreakerIndex = tieBreakerIndex;

      const testing = ["hardhat", "localhost"].includes(hre.network.name);
      let signer: Signer;
      if (testing) {
        console.log("impersonating:", deployerAddress);
        await hre.network.provider.request({
          method: "hardhat_impersonateAccount",
          params: [deployerAddress],
        });
        signer = await hre.ethers.provider.getSigner(deployerAddress);
      } else if (hre.network.name === "matic" || hre.network.name === "base") {
        signer = await getRelayerSigner(hre);
      } else {
        throw Error("Incorrect network selected");
      }

      const signerAddress = await signer.getAddress();
      if (signerAddress.toLowerCase() !== deployerAddress.toLowerCase()) {
        throw new Error(
          `Deployer ${deployerAddress} does not match signer ${signerAddress}`
        );
      }

      const maxProcess = 500; // batch size

      // Enforce required batch size on Base network
      if (hre.network.name === "base" && maxProcess !== 500) {
        throw new Error(
          `On Base network, batchSize must be 500. Current value: ${maxProcess}`
        );
      }
      const finalRewards: rarityRewards = {};

      //Get data for this round from file
      const {
        dataArgs,
      } = require(`../data/airdrops/rarityfarming/szn${taskArgs.season}/${filename}.ts`);
      const data: RarityFarmingData = dataArgs;

      const leaderboards = ["withSetsRarityScore", "kinship", "experience"];
      const dataNames: LeaderboardDataName[] = [
        "rarityGotchis",
        "kinshipGotchis",
        "xpGotchis",
      ];

      const leaderboardResults: RarityFarmingData = {
        rarityGotchis: [],
        xpGotchis: [],
        kinshipGotchis: [],
      };

      for (let index = 0; index < leaderboards.length; index++) {
        let element: LeaderboardType = leaderboards[index] as LeaderboardType;

        console.log("fetching leaderboard for:", element);
        console.log("tiebreaker index:", tiebreakerIndex);

        const result = stripGotchis(
          await fetchAndSortLeaderboard(
            element,
            blockNumber,
            Number(tieBreakerIndex),
            Number(blockTimestamp)
          )
        );

        const dataName: LeaderboardDataName = dataNames[
          index
        ] as LeaderboardDataName;

        console.log("check correctness");

        const correct = confirmCorrectness(result, data[dataName]);

        console.log("correct:", correct);

        if (correct !== 7500) {
          throw new Error("Results do not line up with subgraph");
        }

        leaderboardResults[dataName] = result;
      }

      //Iterate through all 7500 spots
      for (let index = 0; index < 7500; index++) {
        const gotchis: string[] = [
          leaderboardResults.rarityGotchis[index],
          leaderboardResults.kinshipGotchis[index],
          leaderboardResults.xpGotchis[index],
        ];

        const rewards: number[][] = [
          rarityRoundRewards,
          kinshipRoundRewards,
          xpRoundRewards,
        ];

        rewards.forEach((leaderboard, i) => {
          const gotchi = gotchis[i];
          const reward = leaderboard[index];

          if (finalRewards[gotchi])
            finalRewards[gotchi] += Number(reward) / rounds;
          else {
            finalRewards[gotchi] = Number(reward) / rounds;
          }
        });
      }

      //Check that sent amount matches total amount per round
      const roundAmount = Number(taskArgs.totalAmount) / rounds;
      let talliedAmount = 0;

      Object.keys(finalRewards).map((gotchiId) => {
        const amount = finalRewards[gotchiId];

        if (!isNaN(amount)) {
          talliedAmount = talliedAmount + amount;
        }
      });

      const sorted: string[] = [];
      const sortedKeys = Object.keys(finalRewards).sort((a, b) => {
        return finalRewards[b] - finalRewards[a];
      });

      sortedKeys.forEach((key) => {
        sorted.push(`${key}: ${finalRewards[key]}`);
      });

      if (roundAmount - talliedAmount > 1 || roundAmount - talliedAmount < -1) {
        throw new Error(
          `Tallied amount ${talliedAmount} does not match round amount ${roundAmount}`
        );
      }

      console.log("Total GHST to send:", talliedAmount);
      console.log("Round amount:", roundAmount);

      let txData: TxArgs[][] = [];
      let txGroup: TxArgs[] = [];
      let tokenIdsNum = 0;

      //Prepare rewards for each round

      for (const gotchiID of Object.keys(finalRewards)) {
        let amount = finalRewards[gotchiID];

        let parsedAmount = BigNumber.from(parseEther(amount.toString()));
        let finalParsed = parsedAmount.toString();

        if (maxProcess < tokenIdsNum + 1) {
          txData.push(txGroup);
          txGroup = [];
          tokenIdsNum = 0;
        }

        txGroup.push({
          tokenID: gotchiID,
          amount: amount,
          parsedAmount: finalParsed,
        });
        tokenIdsNum += 1;
      }

      if (tokenIdsNum > 0) {
        txData.push(txGroup);
        txGroup = [];
        tokenIdsNum = 0;
      }

      console.log("set allowance for:", deployerAddress);

      if (hre.network.name === "hardhat") {
        await mine();
      }

      await setAllowance(
        hre,
        signer,
        deployerAddress,
        baseDiamondAddress,
        ghstAddressBase
      );

      // Get network chain ID early for progress file naming
      const chainId = await hre.ethers.provider
        .getNetwork()
        .then((n) => n.chainId);

      // Initialize or load progress
      const loadedProgress = loadProgress(taskArgs.season, filename, chainId);
      let progress: ProgressFile;
      if (!loadedProgress) {
        progress = initializeProgress(
          taskArgs.season,
          filename,
          txData.length,
          chainId
        );
        console.log(
          `Initialized new progress file for season ${taskArgs.season}, round ${filename}, chainId ${chainId}`
        );
      } else {
        progress = loadedProgress;
        console.log(
          `Loaded existing progress: ${progress.completedBatches.length}/${progress.totalBatches} batches completed (chainId: ${progress.chainId})`
        );

        // Validate chainId matches
        if (progress.chainId !== chainId) {
          throw new Error(
            `Chain ID mismatch! Progress file is for chainId ${progress.chainId}, but current network is chainId ${chainId}`
          );
        }
      }

      // De-duplicate any gotchis that have already been processed according to the loaded progress
      if (progress.completedGotchiIds && progress.completedGotchiIds.size > 0) {
        const originalItemCount = txData.reduce(
          (sum, group) => sum + group.length,
          0
        );
        txData = txData.map((group) =>
          group.filter((item) => !progress.completedGotchiIds.has(item.tokenID))
        );
        const newItemCount = txData.reduce(
          (sum, group) => sum + group.length,
          0
        );
        const removedCount = originalItemCount - newItemCount;
        if (removedCount > 0) {
          console.log(
            `De-duplicated ${removedCount} gotchis from final array based on progress file (${getProgressFilePath(
              taskArgs.season,
              filename,
              chainId
            )})`
          );
        }
      }

      //total amount of gotchis to send
      const totalGotchis = txData.reduce((sum, group) => sum + group.length, 0);
      console.log("Total gotchis to send:", totalGotchis);

      //total amount of ghst to send
      const totalGhst = txData.reduce(
        (sum, group) =>
          sum + group.reduce((sum, item) => sum + Number(item.amount), 0),
        0
      );
      console.log("Total GHST to send:", totalGhst);

      //total batches to send
      const totalBatches = txData.length;
      console.log("Total batches to send:", totalBatches);

      if (!taskArgs.confirmSend) {
        console.log(
          "Dry run complete. Set CONFIRM_SEND=1 and re-run to actually send the GHST."
        );
        return;
      }

      const proceed = await askForConfirmation(
        `Are you sure you want to send ${totalGhst} GHST to ${totalGotchis} gotchis in ${totalBatches} batches on ${hre.network.name}?`
      );
      if (!proceed) {
        console.log("User did not confirm. Aborting without sending.");
        return;
      }

      console.log("Sending GHST...");

      await sendGhst(hre, signer, txData, progress, taskArgs.season, filename);
    }
  );

async function setAllowance(
  hre: HardhatRuntimeEnvironment,
  signer: Signer,
  deployerAddress: string,
  baseDiamondAddress: string,
  ghstAddress: string
) {
  const ghstToken = (await hre.ethers.getContractAt(
    "@openzeppelin/contracts/token/ERC20/ERC20.sol:ERC20",
    ghstAddress,
    signer
  )) as ERC20;

  const allowance = await ghstToken.allowance(
    deployerAddress,
    baseDiamondAddress
  );

  console.log("allownce:", allowance.toString());

  if (allowance.lt(hre.ethers.utils.parseEther("375000"))) {
    console.log("Setting allowance");

    const tx = await ghstToken.approve(
      baseDiamondAddress,
      hre.ethers.constants.MaxUint256
    );
    await tx.wait();
    console.log("Allowance set!");
  }
}

interface SacrificedGotchi {
  id: string;
  // Add other properties if needed
}

function getProgressFilePath(
  season: string,
  filename: string,
  chainId: number
): string {
  return path.join(
    __dirname,
    `../progress-szn${season}-${filename}-chain${chainId}.json`
  );
}

function askForConfirmation(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(`${message} (type 'yes' to confirm): `, (answer) => {
      rl.close();
      const normalized = answer.trim().toLowerCase();
      resolve(normalized === "yes" || normalized === "y");
    });
  });
}

function loadProgress(
  season: string,
  filename: string,
  chainId: number
): ProgressFile | null {
  const progressPath = getProgressFilePath(season, filename, chainId);

  if (!fs.existsSync(progressPath)) {
    return null;
  }

  try {
    const data = JSON.parse(fs.readFileSync(progressPath, "utf8"));
    // Convert completedGotchiIds array back to Set
    data.completedGotchiIds = new Set(data.completedGotchiIds || []);
    // Ensure backward compatibility: add default status and keep optional fields
    data.completedBatches = (data.completedBatches || []).map((b: any) => ({
      ...b,
      status: b.status ?? "confirmed",
    }));
    return data;
  } catch (error) {
    console.log(`Error loading progress file: ${error}`);
    return null;
  }
}

function saveProgress(
  progress: ProgressFile,
  season: string,
  filename: string
): void {
  const progressPath = getProgressFilePath(season, filename, progress.chainId);

  // Convert Set to array for JSON serialization
  const dataToSave = {
    ...progress,
    completedGotchiIds: Array.from(progress.completedGotchiIds),
  };

  fs.writeFileSync(progressPath, JSON.stringify(dataToSave, null, 2));
  console.log(`Progress saved to: ${progressPath}`);
}

function initializeProgress(
  season: string,
  filename: string,
  totalBatches: number,
  chainId: number
): ProgressFile {
  return {
    season,
    round: filename,
    chainId,
    totalBatches,
    completedBatches: [],
    completedGotchiIds: new Set<string>(),
  };
}

async function sendGhst(
  hre: HardhatRuntimeEnvironment,
  signer: Signer,
  txData: TxArgs[][],
  progress: ProgressFile,
  season: string,
  filename: string
) {
  let totalGhstSent = BigNumber.from(0);

  // Fetch sacrificed gotchis dynamically to ensure they don't break the batchDepositGHST function
  const sacrificedList: SacrificedGotchi[] = await fetchSacrificedGotchis();

  // Chain ID is already stored in progress object

  for (const [i, txGroup] of txData.entries()) {
    console.log(`\n=== Processing batch ${i + 1}/${txData.length} ===`);

    // Check if there is existing progress for this batch
    const existingBatch = progress.completedBatches.find(
      (batch) => batch.batchIndex === i
    );
    if (existingBatch) {
      if (existingBatch.status === "confirmed") {
        console.log(`Batch ${i} already confirmed, skipping...`);
        continue;
      }
      if (existingBatch.status === "pending") {
        console.log(
          `Batch ${i} has pending tx ${existingBatch.transactionHash}. Waiting for confirmation...`
        );
        const pendingReceipt: any =
          await hre.ethers.provider.waitForTransaction(
            existingBatch.transactionHash,
            1
          );
        if (pendingReceipt && pendingReceipt.status) {
          existingBatch.blockNumber = pendingReceipt.blockNumber;
          existingBatch.gasUsed = pendingReceipt.gasUsed.toString();
          existingBatch.status = "confirmed";
          // Mark gotchis as completed now that it's confirmed
          (existingBatch.gotchiRewards || []).forEach((r) =>
            progress.completedGotchiIds.add(r.gotchiId)
          );
          saveProgress(progress, season, filename);
          console.log(
            `Batch ${i} confirmed on resume. Tx: ${existingBatch.transactionHash}`
          );
          continue;
        } else {
          existingBatch.status = "failed";
          saveProgress(progress, season, filename);
          throw new Error(
            `Pending transaction failed for batch ${i}: ${existingBatch.transactionHash}`
          );
        }
      }
    }

    let tokenIds: string[] = [];
    let amounts: string[] = [];
    let gotchiRewards: GotchiReward[] = [];

    // Filter out sacrificed gotchis and gotchis that were already processed
    txGroup.forEach((sendData) => {
      if (sacrificedList.map((val) => val.id).includes(sendData.tokenID)) {
        console.log(
          `Removing ${sendData.tokenID} because it's been sacrificed`
        );
      } else if (progress.completedGotchiIds.has(sendData.tokenID)) {
        console.log(
          `Removing ${sendData.tokenID} because it was already processed in a previous batch`
        );
      } else {
        tokenIds.push(sendData.tokenID);
        amounts.push(sendData.parsedAmount);
        gotchiRewards.push({
          gotchiId: sendData.tokenID,
          amount: sendData.amount.toString(),
          parsedAmount: sendData.parsedAmount,
        });
      }
    });

    if (tokenIds.length === 0) {
      console.log("No valid gotchis to process in this batch, skipping...");
      continue;
    }

    let totalAmount = amounts.reduce((prev, curr) => {
      return BigNumber.from(prev).add(BigNumber.from(curr)).toString();
    });

    totalGhstSent = totalGhstSent.add(totalAmount);

    console.log(
      `Sending ${formatEther(totalAmount)} GHST to ${
        tokenIds.length
      } Gotchis (from ${tokenIds[0]} to ${tokenIds[tokenIds.length - 1]})`
    );

    const escrowFacet = (
      await hre.ethers.getContractAt("EscrowFacet", baseDiamondAddress)
    ).connect(signer) as EscrowFacet;

    try {
      const tx = await escrowFacet.batchDepositGHST(tokenIds, amounts);
      console.log("Transaction submitted with tx hash:", tx.hash);

      // Record pending batch immediately
      const pendingBatch: BatchProgress = {
        batchIndex: i,
        transactionHash: tx.hash,
        timestamp: new Date().toISOString(),
        gotchiRewards,
        totalAmount,
        chainId: progress.chainId,
        status: "pending",
      };
      progress.completedBatches.push(pendingBatch);
      saveProgress(progress, season, filename);

      let receipt: ContractReceipt = await tx.wait();
      console.log("receipt:", receipt.transactionHash);
      console.log("Gas used:", strDisplay(receipt.gasUsed.toString()));

      if (!receipt.status) {
        throw Error(`Transaction failed: ${tx.hash}`);
      }

      // Update the previously recorded pending batch to confirmed
      const recorded = progress.completedBatches.find(
        (b) => b.batchIndex === i && b.transactionHash === tx.hash
      );
      if (recorded) {
        recorded.blockNumber = receipt.blockNumber;
        recorded.gasUsed = receipt.gasUsed.toString();
        recorded.status = "confirmed";
      }
      tokenIds.forEach((id) => progress.completedGotchiIds.add(id));

      // Save progress after each successful batch
      saveProgress(progress, season, filename);

      console.log("Total GHST Sent:", formatEther(totalGhstSent));
      console.log(`Batch ${i + 1} completed and saved to progress file`);
    } catch (error) {
      console.log("Transaction failed:", error);
      console.log(`Stopping execution. Progress saved up to batch ${i}.`);
      throw error; // Stop execution on transaction failure
    }
  }

  console.log(`\n=== All batches completed! ===`);
  console.log(
    `Total batches processed: ${progress.completedBatches.length}/${progress.totalBatches}`
  );
  console.log(`Total GHST sent: ${formatEther(totalGhstSent)}`);
  console.log(
    `Progress file: ${getProgressFilePath(season, filename, progress.chainId)}`
  );
}
