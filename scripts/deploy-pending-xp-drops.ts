import { HardhatRuntimeEnvironment } from "hardhat/types";
import * as fs from "fs";
import * as path from "path";
import { Signer } from "ethers";
import {
  baseRelayerAddress,
  chainAddressesMap,
  getRelayerSigner,
} from "./helperFunctions";
import { generateMerkleTree } from "./query/getAavegotchisXPData";
import { MerkleDropFacet } from "../typechain";
import { ContractTransaction } from "@ethersproject/contracts";
import { LedgerSigner } from "@anders-t/ethers-ledger";
import {
  DeploymentOptions,
  XPDropTracking,
  XPDropTrackingEntry,
  filterPendingAGIPs,
  parseDeploymentOptions,
} from "./xp-drop-deploy-utils";

class XPDropDeployer {
  private hre: HardhatRuntimeEnvironment;
  private isDryRun: boolean;
  private signer: Signer | null = null;
  private merkleDropContract: MerkleDropFacet | null = null;
  private diamondAddress: string;

  constructor(hre: HardhatRuntimeEnvironment, isDryRun: boolean = false) {
    this.hre = hre;
    this.isDryRun = isDryRun;

    // Set diamond address based on network
    if (hre.network.name === "base") {
      this.diamondAddress = chainAddressesMap[8453].aavegotchiDiamond;
    } else if (hre.network.name === "matic") {
      this.diamondAddress = chainAddressesMap[137].aavegotchiDiamond;
    } else {
      // Default to Base for testing
      this.diamondAddress = chainAddressesMap[8453].aavegotchiDiamond;
    }
  }

  async initialize(): Promise<void> {
    console.log(`🔧 Initializing XP Drop Deployer...`);
    console.log(`   Network: ${this.hre.network.name}`);
    console.log(`   Diamond: ${this.diamondAddress}`);
    console.log(`   Dry Run: ${this.isDryRun ? "✅" : "❌"}`);

    // Setup signer
    const testing = ["hardhat", "localhost"].includes(this.hre.network.name);

    if (testing || this.isDryRun) {
      const gameManager = baseRelayerAddress;
      await this.hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [gameManager],
      });

      // Fund the impersonated account for gas
      await this.hre.network.provider.send("hardhat_setBalance", [
        gameManager,
        "0x1000000000000000000", // 1 ETH
      ]);

      this.signer = await this.hre.ethers.provider.getSigner(gameManager);
      console.log(`   Signer: Impersonated game manager (${gameManager})`);
    } else if (this.hre.network.name === "base") {
      this.signer = new LedgerSigner(
        this.hre.ethers.provider,
        "44'/60'/1'/0/0"
      );

      //await getRelayerSigner(this.hre);
      console.log(`   Signer: Ledger`);
    } else {
      throw new Error(
        `Network ${this.hre.network.name} not supported for production deployment`
      );
    }

    // Setup contract
    this.merkleDropContract = (
      await this.hre.ethers.getContractAt(
        "MerkleDropFacet",
        this.diamondAddress
      )
    ).connect(this.signer) as MerkleDropFacet;

    console.log(`✅ Initialization complete\n`);
  }

  async loadTrackingData(): Promise<XPDropTracking> {
    const trackingPath = path.join(__dirname, "xp-drop-tracking.json");

    if (!fs.existsSync(trackingPath)) {
      throw new Error(`Tracking file not found: ${trackingPath}`);
    }

    const trackingData: XPDropTracking = JSON.parse(
      fs.readFileSync(trackingPath, "utf8")
    );

    console.log(
      `📊 Loaded tracking data: ${Object.keys(trackingData).length} AGIPs`
    );
    return trackingData;
  }

  async getPendingAGIPs(
    tracking: XPDropTracking,
    options: DeploymentOptions
  ): Promise<XPDropTrackingEntry[]> {
    const pending = filterPendingAGIPs(tracking, options);

    console.log(`🔍 Found ${pending.length} pending AGIPs:`);
    pending.forEach((entry) => {
      console.log(`   AGIP ${entry.agip_number}: ${entry.title}`);
    });

    return pending;
  }

  async verifyXPDropExists(proposalId: string): Promise<boolean> {
    try {
      const xpDrop = await this.merkleDropContract!.viewXPDrop(proposalId);
      // Check if xpAmount > 0 (indicates drop exists)
      return xpDrop.xpAmount.gt(0);
    } catch (error) {
      return false;
    }
  }

  async deployXPDropPair(entry: XPDropTrackingEntry): Promise<{
    tx?: ContractTransaction;
  }> {
    console.log(`\n🚀 Deploying AGIP ${entry.agip_number}: ${entry.title}`);

    // Generate merkle trees for both proposals
    console.log(`   📝 Generating merkle tree for sigprop...`);
    const { root: sigpropRoot, prop: sigprop } = await generateMerkleTree(
      entry.sigprop_id,
      this.hre
    );

    console.log(`   📝 Generating merkle tree for coreprop...`);
    const { root: corepropRoot, prop: coreprop } = await generateMerkleTree(
      entry.coreprop_id,
      this.hre
    );

    if (this.isDryRun) {
      console.log(`   🔍 DRY RUN - Would deploy:`);
      console.log(`      Sigprop: ${sigprop.title} (${entry.sigprop_id})`);
      console.log(`      Coreprop: ${coreprop.title} (${entry.coreprop_id})`);
      console.log(`      Sigprop XP: 10, Coreprop XP: 20`);
      return { tx: undefined };
    }

    // Deploy both using batch function for atomic operation
    console.log(`   📤 Batch deploying sigprop + coreprop: ${entry.title}`);
    const batchTx = await this.merkleDropContract!.batchCreateXPDrop(
      [entry.sigprop_id, entry.coreprop_id],
      [sigpropRoot, corepropRoot],
      [10, 20] // sigprop: 10 XP, coreprop: 20 XP
    );
    console.log(`      Batch Tx Hash: ${batchTx.hash}`);

    return { tx: batchTx };
  }

  async verifyDeployment(
    entry: XPDropTrackingEntry,
    maxRetries: number = 5
  ): Promise<boolean> {
    if (this.isDryRun) {
      console.log(`   ✅ DRY RUN - Skipping verification`);
      return true;
    }

    console.log(`   🔍 Verifying deployment...`);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const sigpropExists = await this.verifyXPDropExists(entry.sigprop_id);
      const corepropExists = await this.verifyXPDropExists(entry.coreprop_id);

      console.log(`      Attempt ${attempt}/${maxRetries}:`);
      console.log(`      Sigprop deployed: ${sigpropExists ? "✅" : "❌"}`);
      console.log(`      Coreprop deployed: ${corepropExists ? "✅" : "❌"}`);

      const bothDeployed = sigpropExists && corepropExists;

      if (bothDeployed) {
        console.log(`   ✅ Verification successful on attempt ${attempt}`);
        return true;
      }

      if (attempt < maxRetries) {
        console.log(`   ⏳ Waiting 3 seconds before retry...`);
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }

    console.log(`   ❌ Verification failed after ${maxRetries} attempts`);
    return false;
  }

  async updateTrackingData(
    tracking: XPDropTracking,
    agipKey: string,
    txHashes?: string[]
  ): Promise<void> {
    if (this.isDryRun) {
      console.log(`   📝 DRY RUN - Would update tracking for ${agipKey}`);
      return;
    }

    tracking[agipKey].status = "deployed";
    tracking[agipKey].deployed_date = new Date().toISOString();

    if (txHashes && txHashes.length > 0) {
      tracking[agipKey].tx_hash = txHashes.join(",");
    }

    // Save updated tracking data
    const trackingPath = path.join(__dirname, "xp-drop-tracking.json");

    // Sort tracking data by AGIP number (highest to lowest) before saving
    const sortedTracking: XPDropTracking = {};
    const sortedKeys = Object.keys(tracking).sort((a, b) => {
      const agipA = tracking[a].agip_number;
      const agipB = tracking[b].agip_number;
      return agipB - agipA; // Sort descending (highest first)
    });

    for (const key of sortedKeys) {
      sortedTracking[key] = tracking[key];
    }

    fs.writeFileSync(trackingPath, JSON.stringify(sortedTracking, null, 2));
    console.log(`   📝 Updated tracking data`);
  }

  async deployPendingXPDrops(options: DeploymentOptions): Promise<void> {
    await this.initialize();

    const tracking = await this.loadTrackingData();
    const pendingAGIPs = await this.getPendingAGIPs(tracking, options);

    if (options.agipNumbers && options.agipNumbers.size > 0) {
      console.log(
        `🎯 Requested AGIP filter: ${Array.from(options.agipNumbers)
          .sort((a, b) => a - b)
          .join(", ")}`
      );
    }

    if (pendingAGIPs.length === 0) {
      console.log(`\n🎉 No pending XP drops to deploy!`);
      return;
    }

    console.log(
      `\n🚀 Starting deployment of ${pendingAGIPs.length} AGIP pairs...\n`
    );

    let deployed = 0;
    let failed = 0;

    for (const entry of pendingAGIPs) {
      const agipKey = `agip_${entry.agip_number}`;

      try {
        // Deploy the XP drop pair
        const { tx } = await this.deployXPDropPair(entry);

        // Wait for batch transaction to be mined (if not dry run)
        if (!this.isDryRun && tx) {
          console.log(`   ⏳ Waiting for batch transaction to be mined...`);
          await tx.wait();

          // Additional wait to ensure contract state is settled
          console.log(`   ⏳ Waiting for contract state to settle...`);
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }

        // Verify deployment with retry logic
        const isDeployed = await this.verifyDeployment(entry, 5);

        if (!isDeployed && !this.isDryRun) {
          throw new Error(
            `Deployment verification failed for AGIP ${entry.agip_number}`
          );
        }

        // Update tracking data
        const txHashes = tx ? [tx.hash] : [];
        await this.updateTrackingData(tracking, agipKey, txHashes);

        deployed++;
        console.log(`✅ AGIP ${entry.agip_number} deployment complete\n`);
      } catch (error) {
        failed++;
        console.error(`❌ Failed to deploy AGIP ${entry.agip_number}:`, error);

        if (!this.isDryRun) {
          throw error; // Stop on first failure in production
        }
      }
    }

    console.log(`\n📊 Deployment Summary:`);
    console.log(`   ✅ Successful: ${deployed}`);
    console.log(`   ❌ Failed: ${failed}`);

    if (this.isDryRun) {
      console.log(`\n🔍 This was a dry run. No actual deployments were made.`);
      console.log(`Remove --dry-run flag to perform actual deployments.`);
    }
  }
}

// CLI interface
async function main() {
  const hre = require("hardhat");
  const options = parseDeploymentOptions(process.argv);
  const { isDryRun } = options;

  if (!isDryRun && hre.network.name === "base") {
    console.log(`⚠️  WARNING: About to deploy to BASE network!`);
    console.log(`Please confirm this is intended before proceeding.`);
    console.log(`Add --dry-run flag to test safely on hardhat.`);

    // Add a confirmation prompt in production
    const readline = require("readline");
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const answer = await new Promise<string>((resolve) => {
      rl.question("Type 'CONFIRM' to proceed with BASE deployment: ", resolve);
    });
    rl.close();

    if (answer !== "CONFIRM") {
      console.log("❌ Deployment cancelled");
      process.exit(0);
    }
  }

  const deployer = new XPDropDeployer(hre, isDryRun);
  await deployer.deployPendingXPDrops(options);
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("❌ Deployment failed:", error);
      process.exit(1);
    });
}

export { XPDropDeployer };
