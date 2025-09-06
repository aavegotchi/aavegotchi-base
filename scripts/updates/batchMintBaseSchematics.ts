import { ethers, network } from "hardhat";
import { getLedgerSigner, impersonate } from "../helperFunctions";
import { ForgeDAOFacet, ForgeFacet, ItemsFacet } from "../../typechain";

import { varsForNetwork } from "../../helpers/constants";
import { PC_WALLET } from "../geistBridge/paths";
import { mine } from "@nomicfoundation/hardhat-network-helpers";

export async function batchMintBaseWearables() {
  const c = await varsForNetwork(ethers);

  const testing = ["hardhat", "localhost"].includes(network.name);
  let forgeFacet = (await ethers.getContractAt(
    "contracts/Aavegotchi/ForgeDiamond/facets/ForgeFacet.sol:ForgeFacet",
    c.forgeDiamond!
  )) as ForgeFacet;

  let forgeDaoFacet = (await ethers.getContractAt(
    "contracts/Aavegotchi/ForgeDiamond/facets/ForgeDAOFacet.sol:ForgeDAOFacet",
    c.forgeDiamond!
  )) as ForgeDAOFacet;

  if (testing) {
    const ownershipFacet = await ethers.getContractAt(
      "OwnershipFacet",
      c.forgeDiamond!
    );

    await mine();

    const owner = await ownershipFacet.owner();

    console.log("current owner:", owner);

    forgeFacet = await impersonate(owner, forgeFacet, ethers, network);
    forgeDaoFacet = await impersonate(owner, forgeDaoFacet, ethers, network);
  } else if (network.name === "base") {
    //item manager - ledger
    const signer = await getLedgerSigner(ethers);
    forgeFacet = forgeFacet.connect(signer);
    forgeDaoFacet = forgeDaoFacet.connect(signer);
  } else throw Error("Incorrect network selected");

  // schematics
  const common = [418];
  const rare = [419];
  const legendary = [420];
  const ids = [common, rare, legendary];
  const totalAmounts = [1000, 250, 100];

  //10% to pixelcraft, 90% to forge diamond
  const percents = [0.1, 0.9];
  const receipients = [PC_WALLET, c.forgeDiamond!];
  let toForge: number[] = [];

  for (let j = 0; j < receipients.length; j++) {
    const transferAmount = [];
    const transferIds = [];

    const recipient = receipients[j];
    const percent = percents[j];

    for (let i = 0; i < ids.length; i++) {
      for (let j = 0; j < ids[i].length; j++) {
        transferIds.push(ids[i][j]);
        transferAmount.push(totalAmounts[i] * percent);
      }
    }

    console.log(
      `Batch minting to ${recipient}: ${transferIds} ${transferAmount}`
    );

    const tx = await forgeFacet.adminMintBatch(
      recipient,
      transferIds,
      transferAmount
    );
    console.log("tx hash:", tx.hash);
    const receipt = await tx.wait();
    if (!receipt.status) {
      throw Error(`Error with transaction: ${tx.hash}`);
    }

    if (j === 1) {
      toForge = transferIds;
    }
  }

  console.log("aavegotchiDiamond:", c.aavegotchiDiamond);

  const itemsFacet = (await ethers.getContractAt(
    "contracts/Aavegotchi/facets/ItemsFacet.sol:ItemsFacet",
    c.aavegotchiDiamond!
  )) as ItemsFacet;

  const idsFlat = [418, 419, 420];
  const items = await itemsFacet.getItemTypes(idsFlat);
  let modifiers: number[] = [];
  for (let i = 0; i < items.length; i++) {
    modifiers.push(Number(items[i].rarityScoreModifier));
  }

  console.log("Creating Geode Prizes for Schematics:", idsFlat);
  console.log("rarites", modifiers);

  const tx = await forgeDaoFacet.setMultiTierGeodePrizes(
    idsFlat,
    toForge,
    modifiers
  );
  console.log("tx hash:", tx.hash);
  await tx.wait();

  console.log("set multi tier geode prizes");

  // Verification: Check on-chain balances
  console.log("\n=== VERIFICATION: Checking on-chain balances ===");

  const forgeTokenFacet = (await ethers.getContractAt(
    "contracts/Aavegotchi/ForgeDiamond/facets/ForgeTokenFacet.sol:ForgeTokenFacet",
    c.forgeDiamond!
  )) as any; // Using any to avoid type issues with the interface

  let allBalancesCorrect = true;

  // Calculate expected balances dynamically using the same arrays as minting
  const expectedBalances = [];

  for (let j = 0; j < receipients.length; j++) {
    const recipient = receipients[j];
    const percent = percents[j];
    const name = j === 0 ? "PC_WALLET" : "ForgeDiamond";

    const expectedItemIds = [];
    const expectedAmounts = [];

    for (let i = 0; i < ids.length; i++) {
      for (let k = 0; k < ids[i].length; k++) {
        expectedItemIds.push(ids[i][k]);
        expectedAmounts.push(totalAmounts[i] * percent);
      }
    }

    expectedBalances.push({
      recipient,
      name,
      itemIds: expectedItemIds,
      amounts: expectedAmounts,
    });
  }

  for (const expected of expectedBalances) {
    console.log(
      `\nChecking balances for ${expected.name} (${expected.recipient}):`
    );

    for (let i = 0; i < expected.itemIds.length; i++) {
      const itemId = expected.itemIds[i];
      const expectedAmount = expected.amounts[i];

      try {
        const actualBalance = await forgeTokenFacet.balanceOf(
          expected.recipient,
          itemId
        );
        const actualAmount = Number(actualBalance.toString());

        if (actualAmount === expectedAmount) {
          console.log(`  ✅ Item ID ${itemId}: ${actualAmount} (correct)`);
        } else {
          console.log(
            `  ❌ Item ID ${itemId}: Expected ${expectedAmount}, got ${actualAmount}`
          );
          allBalancesCorrect = false;
        }
      } catch (error) {
        console.log(
          `  ❌ Item ID ${itemId}: Error checking balance - ${error}`
        );
        allBalancesCorrect = false;
      }
    }
  }

  // Summary
  console.log("\n=== VERIFICATION SUMMARY ===");
  if (allBalancesCorrect) {
    console.log("✅ All balances verified successfully!");
  } else {
    console.log(
      "❌ Some balance mismatches detected. Please review the output above."
    );
    if (!testing) {
      throw new Error(
        "Balance verification failed - aborting to prevent issues"
      );
    }
  }
}

if (require.main === module) {
  batchMintBaseWearables()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
