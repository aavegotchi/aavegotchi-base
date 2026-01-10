import { task } from "hardhat/config";
import {
  Contract,
  ContractFactory,
  ContractReceipt,
  ContractTransaction,
  PopulatedTransaction,
} from "@ethersproject/contracts";
import { Signer } from "@ethersproject/abstract-signer";

import { IDiamondCut } from "../typechain";
import { LedgerSigner } from "@anders-t/ethers-ledger";
import {
  getSelectors,
  getSighashes,
  delay,
  verifyContract,
  getRelayerSigner,
} from "../scripts/helperFunctions";

import { HardhatRuntimeEnvironment } from "hardhat/types";
import { mine } from "@nomicfoundation/hardhat-network-helpers";
import { sendToMultisig } from "../scripts/libraries/multisig/multisig";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import {
  buildPlannedSnapshot,
  captureDiamondSnapshot,
  generateDiamondDiffReport,
  loadFacetCatalog,
  logDiffSummary,
  persistDiffReport,
  PlannedFacetInput,
  PlannedDiamondState,
  diffFacetAgainstReference,
  readSnapshotHistory,
  writeSnapshotHistory,
} from "../scripts/utils/diamondState";
import { execSync } from "child_process";

export interface FacetsAndAddSelectors {
  facetName: string;
  addSelectors: string[];
  removeSelectors: string[];
}

type FacetCutType = { Add: 0; Replace: 1; Remove: 2 };
const FacetCutAction: FacetCutType = { Add: 0, Replace: 1, Remove: 2 };

export interface DeployUpgradeTaskArgs {
  diamondOwner: string;
  diamondAddress: string;
  facetsAndAddSelectors: string;
  useMultisig: boolean;
  useLedger: boolean;
  initAddress?: string;
  initCalldata?: string;
  rawSigs?: boolean;
  useRelayer: boolean;
  // updateDiamondABI: boolean;
  freshDeployment?: boolean;
  reportOnly?: boolean;
}

interface Cut {
  facetAddress: string;
  action: 0 | 1 | 2;
  functionSelectors: string[];
}

function promptYesNo(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(message, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === "y");
    });
  });
}

export function convertFacetAndSelectorsToString(
  facets: FacetsAndAddSelectors[]
): string {
  let outputString = "";

  facets.forEach((facet) => {
    outputString = outputString.concat(
      `#${facet.facetName}$$$${facet.addSelectors.join(
        "*"
      )}$$$${facet.removeSelectors.join("*")}`
    );
  });

  return outputString;
}

export function convertStringToFacetAndSelectors(
  facets: string
): FacetsAndAddSelectors[] {
  const facetArrays: string[] = facets.split("#").filter((string) => {
    return string.length > 0;
  });

  const output: FacetsAndAddSelectors[] = [];

  facetArrays.forEach((string) => {
    const facetsAndAddSelectors = string.split("$$$");
    output.push({
      facetName: facetsAndAddSelectors[0],
      addSelectors: facetsAndAddSelectors[1].split("*"),
      removeSelectors: facetsAndAddSelectors[2].split("*"),
    });
  });

  return output;
}

task(
  "deployUpgrade",
  "Deploys a Diamond Cut, given an address, facets and addSelectors, and removeSelectors"
)
  .addParam("diamondOwner", "Address of the contract owner")
  .addParam("diamondAddress", "Address of the Diamond to upgrade")
  .addParam(
    "facetsAndAddSelectors",
    "Stringified array of facet names to upgrade, along with an array of add Selectors"
  )
  .addOptionalParam("initAddress", "The facet address to call init function on")
  .addOptionalParam("initCalldata", "The calldata for init function")
  .addFlag(
    "useMultisig",
    "Set to true if multisig should be used for deploying"
  )
  .addFlag("useLedger", "Set to true if Ledger should be used for signing")
  .addFlag("freshDeployment", "This is for Diamonds that are freshly deployed ")
  .addFlag("useRelayer", "Set to true if Relayer should be used for signing")
  .addFlag("reportOnly", "Generate diff report only and skip diamond cut")
  // .addFlag("verifyFacets","Set to true if facets should be verified after deployment")

  .setAction(
    async (taskArgs: DeployUpgradeTaskArgs, hre: HardhatRuntimeEnvironment) => {
      await hre.run("compile");
      const facets: string = taskArgs.facetsAndAddSelectors;
      const facetsAndAddSelectors: FacetsAndAddSelectors[] =
        convertStringToFacetAndSelectors(facets);

      console.log("facetsAndAddSelectors:", facetsAndAddSelectors);

      const diamondOwner: string = taskArgs.diamondOwner;
      const diamondAddress: string = taskArgs.diamondAddress;
      const useMultisig = taskArgs.useMultisig;
      const useLedger = taskArgs.useLedger;
      const initAddress = taskArgs.initAddress;
      const initCalldata = taskArgs.initCalldata;
      const useRelayer = taskArgs.useRelayer;
      const reportOnly = taskArgs.reportOnly;

      const branch = require("git-branch");
      const currentBranch = branch.sync();
      console.log("branch:", currentBranch);
      if (
        hre.network.name === "matic" ||
        (hre.network.name === "base" && currentBranch !== "master")
      ) {
        throw new Error("Not master branch!");
      }

      console.log("instantiate signer");

      //Instantiate the Signer
      let signer: Signer;
      const owner = diamondOwner;
      // const owner = await (
      //   (await hre.ethers.getContractAt(
      //     "OwnershipFacet",
      //     diamondAddress
      //   )) as OwnershipFacet
      // ).owner();
      const testing = ["hardhat", "localhost"].includes(hre.network.name);

      if (testing) {
        await hre.network.provider.request({
          method: "hardhat_impersonateAccount",
          params: [owner],
        });

        console.log("impersonated!");

        await hre.network.provider.request({
          method: "hardhat_setBalance",
          params: [owner, "0x100000000000000000000000"],
        });

        signer = await hre.ethers.getSigner(owner);
        await mine();
      } else if (
        hre.network.name === "matic" ||
        hre.network.name === "polter" ||
        hre.network.name === "base-sepolia" ||
        hre.network.name === "baseSepolia" ||
        hre.network.name === "amoy" ||
        hre.network.name === "geist" ||
        hre.network.name === "base"
      ) {
        if (useLedger) {
          signer = new LedgerSigner(hre.ethers.provider, "m/44'/60'/1'/0/0");
        } else if (useRelayer) {
          signer = await getRelayerSigner(hre);
        } else signer = (await hre.ethers.getSigners())[0];
      } else {
        throw Error("Incorrect network selected");
      }

      //Create the cut
      const deployedFacets = [];
      const cut: Cut[] = [];

      const gitCommit = execSync("git rev-parse HEAD").toString().trim();
      const catalog = await loadFacetCatalog(hre);

      const onChainSnapshotBefore = await captureDiamondSnapshot(
        hre,
        diamondAddress,
        catalog
      );
      onChainSnapshotBefore.commit = gitCommit;

      const history = await readSnapshotHistory(hre, diamondAddress);
      const referenceSnapshot =
        history?.history?.[history.history.length - 1] ?? null;

      interface FacetPlan extends FacetsAndAddSelectors {
        addSelectorHashes: string[];
        removeSelectorHashes: string[];
      }

      const facetPlans: FacetPlan[] = facetsAndAddSelectors.map((facet) => {
        const addSelectorHashes = getSighashes(facet.addSelectors, hre.ethers);
        const removeSelectorHashes =
          taskArgs.rawSigs === true
            ? facet.removeSelectors
            : getSighashes(facet.removeSelectors, hre.ethers);
        return {
          ...facet,
          addSelectorHashes,
          removeSelectorHashes,
        };
      });

      const plannedInputs: PlannedFacetInput[] = facetPlans.map((plan) => ({
        facetName: plan.facetName,
        addSelectors: plan.addSelectorHashes,
        removeSelectors: plan.removeSelectorHashes,
      }));
      const plannedFacetNames = new Set(
        facetPlans.map((plan) => plan.facetName)
      );

      const summarizeFacetChanges = (facet: {
        selectorsAddedNames: string[];
        selectorsRemovedNames: string[];
        selectorsModifiedDirectNames: string[];
        selectorsModifiedIndirectNames: string[];
        internalAdded: string[];
        internalRemoved: string[];
        internalModified: string[];
        eventsAdded: string[];
        eventsRemoved: string[];
        abiChanged: boolean;
        bytecodeChanged?: boolean;
      }) => {
        const segments: string[] = [];
        if (facet.selectorsAddedNames.length) {
          segments.push(
            `added externals (${facet.selectorsAddedNames.join(", ")})`
          );
        }
        if (facet.selectorsRemovedNames.length) {
          segments.push(
            `removed externals (${facet.selectorsRemovedNames.join(", ")})`
          );
        }
        if (facet.selectorsModifiedDirectNames.length) {
          segments.push(
            `modified externals (${facet.selectorsModifiedDirectNames.join(", ")})`
          );
        }
        if (facet.selectorsModifiedIndirectNames.length) {
          segments.push(
            `externals affected via internals (${facet.selectorsModifiedIndirectNames.join(", ")})`
          );
        }
        if (facet.internalAdded.length) {
          segments.push(`added internals (${facet.internalAdded.join(", ")})`);
        }
        if (facet.internalRemoved.length) {
          segments.push(
            `removed internals (${facet.internalRemoved.join(", ")})`
          );
        }
        if (facet.internalModified.length) {
          segments.push(
            `modified internals (${facet.internalModified.join(", ")})`
          );
        }
        if (facet.eventsAdded.length) {
          segments.push(`added events (${facet.eventsAdded.join(", ")})`);
        }
        if (facet.eventsRemoved.length) {
          segments.push(`removed events (${facet.eventsRemoved.join(", ")})`);
        }
        if (facet.abiChanged) {
          segments.push("ABI changed");
        }
        if (facet.bytecodeChanged) {
          segments.push("bytecode changed");
        }
        return segments.join("; ");
      };

      const gatherChangedFiles = (command: string): string[] => {
        try {
          return execSync(command)
            .toString()
            .split(/\r?\n/)
            .map((line: string) => line.trim())
            .filter(Boolean);
        } catch {
          return [];
        }
      };

      const changedFiles = new Set(
        [
          ...gatherChangedFiles("git diff --name-only"),
          ...gatherChangedFiles("git diff --name-only --cached"),
        ].map((file) => file.replace(/\\/g, "/"))
      );

      const baselineSnapshot = referenceSnapshot ?? onChainSnapshotBefore;
      const unplannedFacetChanges: Array<{
        facetName: string;
        sourceName: string;
        detail: string;
      }> = [];

      if (baselineSnapshot) {
        for (const facet of baselineSnapshot.facets) {
          const facetName = facet.facetName;
          if (!facetName) continue;
          if (plannedFacetNames.has(facetName)) continue;
          const catalogEntry = catalog.byName[facetName];
          const sourceName =
            catalogEntry?.sourceName ??
            facet.sourceName ??
            null;
          if (!sourceName || !catalogEntry) continue;
          if (!changedFiles.has(sourceName)) continue;
          const referenceDiff = diffFacetAgainstReference(facet, catalogEntry);
          if (!referenceDiff) continue;
          unplannedFacetChanges.push({
            facetName,
            sourceName,
            detail: summarizeFacetChanges(referenceDiff),
          });
        }
      }

      const plannedState: PlannedDiamondState = await buildPlannedSnapshot(
        hre,
        diamondAddress,
        plannedInputs,
        catalog,
        onChainSnapshotBefore
      );
      plannedState.snapshot.commit = gitCommit;

      const diff = generateDiamondDiffReport(
        referenceSnapshot ?? null,
        plannedState,
        onChainSnapshotBefore
      );
      if (unplannedFacetChanges.length) {
        diff.summary.push("Unplanned local facet changes:");
        unplannedFacetChanges.forEach(({ facetName, sourceName, detail }) => {
          diff.summary.push(
            `  • ${facetName} (${sourceName})${detail ? `: ${detail}` : ""}`
          );
        });
      }
      const diffPath = await persistDiffReport(hre, diff);
      logDiffSummary(diff);
      console.log(`Diff report saved: ${diffPath}`);

      const isMainnetDeployment = hre.network.name === "base";

      const facetDiffByName = new Map(
        diff.facets
          .filter((facet) => facet.facetName)
          .map((facet) => [facet.facetName!, facet])
      );

      const validationErrors: string[] = [];

      for (const change of unplannedFacetChanges) {
        validationErrors.push(
          `Facet ${change.facetName} has local changes in ${change.sourceName} but is not included in this upgrade plan${
            change.detail ? `: ${change.detail}` : "."
          }`
        );
      }

      for (const plan of facetPlans) {
        const facetDiff = facetDiffByName.get(plan.facetName);
        if (!facetDiff) continue;

        if (facetDiff.selectorsAddedDetail.length) {
          const available = new Set(
            plan.addSelectorHashes?.map((hash) => hash.toLowerCase()) ?? []
          );
          const missing = facetDiff.selectorsAddedDetail.filter(
            (detail) => !available.has(detail.selector.toLowerCase())
          );
          if (missing.length) {
            validationErrors.push(
              `Facet ${plan.facetName} adds functions ${missing
                .map((detail) => detail.functionName ?? detail.signature)
                .join(", ")} but they are not listed in addSelectors.`
            );
          }
        }

        if (plan.addSelectorHashes.length) {
          const present = new Set(
            facetDiff.selectorsAddedHex.map((hash) => hash.toLowerCase())
          );
          const missingHashes = plan.addSelectorHashes.filter(
            (hash) => !present.has(hash.toLowerCase())
          );
          if (missingHashes.length) {
            const missingNames = plan.addSelectors.filter((_, idx) =>
              missingHashes.includes(plan.addSelectorHashes[idx])
            );
            validationErrors.push(
              `Facet ${plan.facetName} expects to add functions ${missingNames.join(
                ", "
              )} but no corresponding implementation changes were detected.`
            );
          }
        }

        if (facetDiff.selectorsRemovedDetail.length) {
          const plannedRemovals = new Set(
            plan.removeSelectorHashes?.map((hash) => hash.toLowerCase()) ?? []
          );
          const missing = facetDiff.selectorsRemovedDetail.filter(
            (detail) => !plannedRemovals.has(detail.selector.toLowerCase())
          );
          if (missing.length) {
            validationErrors.push(
              `Facet ${plan.facetName} removes functions ${missing
                .map((detail) => detail.functionName ?? detail.signature)
                .join(", ")} but they are not listed in removeSelectors.`
            );
          }
        }

        if (plan.removeSelectorHashes.length) {
          const removed = new Set(
            facetDiff.selectorsRemovedHex.map((hash) => hash.toLowerCase())
          );
          const missingRemovalHashes = plan.removeSelectorHashes.filter(
            (hash) => !removed.has(hash.toLowerCase())
          );
          if (missingRemovalHashes.length) {
            const missingNames = plan.removeSelectors.filter((_, idx) =>
              missingRemovalHashes.includes(plan.removeSelectorHashes[idx])
            );
            validationErrors.push(
              `Facet ${plan.facetName} expects to remove functions ${missingNames.join(
                ", "
              )} but they remain in the compiled facet.`
            );
          }
        }
      }

      if (validationErrors.length) {
        const message = validationErrors.join("\n");
        throw new Error(
          `Selector reconciliation failed. Ensure your upgrade script's add/remove selectors match the planned changes.\n${message}`
        );
      }

      if (isMainnetDeployment) {
        const diffAbsolutePath = path.isAbsolute(diffPath)
          ? diffPath
          : path.join(process.cwd(), diffPath);
        const symlinkPath = path.join("state", "diamond", "latest-diff.json");
        try {
          if (fs.lstatSync(symlinkPath)) {
            fs.unlinkSync(symlinkPath);
          }
        } catch (error: any) {
          if (error && error.code !== "ENOENT") {
            console.warn(
              `Warning: unable to remove existing diff symlink (${error.message}).`
            );
          }
        }
        try {
          fs.mkdirSync(path.dirname(symlinkPath), { recursive: true });
          fs.symlinkSync(diffAbsolutePath, symlinkPath);
          console.log(
            `Review symlinked diff at ${symlinkPath} (points to ${diffPath}).`
          );
        } catch (error: any) {
          console.warn(
            `Warning: unable to create diff symlink (${error.message}).`
          );
        }

        if (!reportOnly) {
          const confirmed = await promptYesNo(
            "Proceed with diamond upgrade? (y/N): "
          );
          if (!confirmed) {
            console.log("Upgrade aborted by user.");
            return;
          }
        }
      }

      if (reportOnly) {
        console.log(
          "Report only flag detected. Exiting before executing diamond cut."
        );
        return;
      }

      for (let index = 0; index < facetsAndAddSelectors.length; index++) {
        const facet = facetsAndAddSelectors[index];
        const plan = facetPlans[index];

        console.log("facet:", facet);
        if (facet.facetName.length > 0) {
          const factory = (await hre.ethers.getContractFactory(
            facet.facetName
          )) as ContractFactory;
          const deployedFacet: Contract = await factory.deploy();
          await deployedFacet.deployed();
          console.log(
            `Deployed Facet Address for ${facet.facetName}:`,
            deployedFacet.address
          );
          //verify all new facets by default
          //wait for some time to ensure the contract is deployed
          // await delay(2000);
          // await verifyContract(deployedFacet.address);
          deployedFacets.push(deployedFacet);

          const newSelectors = plan.addSelectorHashes;

          let existingFuncs = getSelectors(deployedFacet);
          for (const selector of newSelectors) {
            if (!existingFuncs.includes(selector)) {
              const index = newSelectors.findIndex((val) => val == selector);

              throw Error(
                `Selector ${selector} (${facet.addSelectors[index]}) not found`
              );
            }
          }

          let existingSelectors = getSelectors(deployedFacet);
          existingSelectors = existingSelectors.filter(
            (selector) => !newSelectors.includes(selector)
          );
          if (newSelectors.length > 0) {
            cut.push({
              facetAddress: deployedFacet.address,
              action: FacetCutAction.Add,
              functionSelectors: newSelectors,
            });
          }

          //replace only when not using on newly deplyed diamonds
          if (!taskArgs.freshDeployment) {
            //Always replace the existing selectors to prevent duplications
            if (existingSelectors.length > 0) {
              cut.push({
                facetAddress: deployedFacet.address,
                action: FacetCutAction.Replace,
                functionSelectors: existingSelectors,
              });
            }
          }
        }
        let removeSelectors: string[];
        removeSelectors = plan.removeSelectorHashes;
        if (removeSelectors.length > 0) {
          console.log("Removing selectors:", removeSelectors);
          cut.push({
            facetAddress: hre.ethers.constants.AddressZero,
            action: FacetCutAction.Remove,
            functionSelectors: removeSelectors,
          });
        }
      }

      console.log("diamond cut");

      //Execute the Cut
      const diamondCut = (await hre.ethers.getContractAt(
        "IDiamondCut",
        diamondAddress,
        signer
      )) as IDiamondCut;

      // //Helpful for debugging
      // const diamondLoupe = (await hre.ethers.getContractAt(
      //   "IDiamondLoupe",
      //   diamondAddress,
      //   signer
      // )) as IDiamondLoupe;

      // if (hre.network.name === "tenderly") {
      //   console.log("Diamond cut");
      //   console.log("Using Tenderly");

      //   const tx: PopulatedTransaction =
      //     await diamondCut.populateTransaction.diamondCut(
      //       cut,
      //       initAddress ? initAddress : hre.ethers.constants.AddressZero,
      //       initCalldata ? initCalldata : "0x",
      //       { gasLimit: 800000 }
      //     );
      //   await sendToTenderly(diamondUpgrader, owner, tx);
      // }

      if (testing) {
        console.log("Diamond cut");
        const tx: ContractTransaction = await diamondCut.diamondCut(
          cut,
          initAddress ? initAddress : hre.ethers.constants.AddressZero,
          initCalldata ? initCalldata : "0x",
          { gasLimit: 8000000 }
        );
        console.log("Diamond cut tx:", tx.hash);
        const receipt: ContractReceipt = await tx.wait();
        if (!receipt.status) {
          throw Error(`Diamond upgrade failed: ${tx.hash}`);
        }
        console.log("Completed diamond cut: ", tx.hash);
      } else {
        //Choose to use a multisig or a simple deploy address
        if (useMultisig) {
          console.log("Diamond cut");
          const tx: PopulatedTransaction =
            await diamondCut.populateTransaction.diamondCut(
              cut,
              initAddress ? initAddress : hre.ethers.constants.AddressZero,
              initCalldata ? initCalldata : "0x",
              { gasLimit: 800000 }
            );
          await sendToMultisig(diamondOwner, signer, tx, hre.ethers);
        } else {
          console.log("Diamond cut without multisig");

          const tx: ContractTransaction = await diamondCut.diamondCut(
            cut,
            initAddress ? initAddress : hre.ethers.constants.AddressZero,
            initCalldata ? initCalldata : "0x"
          );

          const receipt: ContractReceipt = await tx.wait();
          if (!receipt.status) {
            throw Error(`Diamond upgrade failed: ${tx.hash}`);
          }
          console.log("Completed diamond cut: ", tx.hash);
        }
      }

      const onChainSnapshotAfter = await captureDiamondSnapshot(
        hre,
        diamondAddress,
        catalog
      );
      onChainSnapshotAfter.commit = gitCommit;
      await writeSnapshotHistory(hre, onChainSnapshotAfter);
      console.log("Captured and persisted new diamond snapshot.");
      // if (hre.network.name !== "hardhat") {
      //   console.log("Verifying Addresses");
      //   await delay(60000);

      //   for (let x = 0; x < cut.length; x++) {
      //     console.log("Addresses to be verified: ", cut[x].facetAddress);
      //     await hre.run("verify:verify", {
      //       address: cut[x].facetAddress,
      //       constructorArguments: [],
      //     });
      //   }
      // }
      console.log("Updating diamond ABI...");
      await hre.run("diamondABI");
      console.log("ABI written to diamondABI/diamond.json");
    }
  );
