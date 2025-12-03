import { Contract } from "@ethersproject/contracts";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DiamondLoupeFacet, OwnershipFacet } from "../typechain";
import * as fs from "fs";
import {
  DefenderRelayProvider,
  DefenderRelaySigner,
} from "defender-relay-client/lib/ethers";

import { LedgerSigner } from "@anders-t/ethers-ledger";
import {
  wearablesBackSvgs,
  wearablesFrontSleeveSvgs,
  wearablesLeftSvgs,
  wearablesRightSvgs,
  wearablesFrontSvgs,
  wearablesBackSleeveSvgs,
  wearablesLeftSleeveSvgs,
  wearablesRightSleeveSvgs,
} from "../svgs/wearables-sides";

export const gasPrice = 570000000000;

export function delay(milliseconds: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

export async function impersonate(
  address: string,
  contract: any,
  ethers: any,
  network: any
) {
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [address],
  });

  //give some ether
  await ethers.provider.send("hardhat_setBalance", [
    address,
    "0x100000000000000000000",
  ]);

  let signer = await ethers.getSigner(address);
  contract = contract.connect(signer);
  return contract;
}

export async function resetChain(hre: any) {
  await hre.network.provider.request({
    method: "hardhat_reset",
    params: [
      {
        forking: {
          jsonRpcUrl: process.env.MATIC_URL,
        },
      },
    ],
  });
}

export function getSighashes(selectors: string[], ethers: any): string[] {
  if (selectors.length === 0) return [];
  const sighashes: string[] = [];
  selectors.forEach((selector) => {
    if (selector !== "") sighashes.push(getSelector(selector, ethers));
  });
  return sighashes;
}

export function getSelectors(contract: Contract) {
  const signatures = Object.keys(contract.interface.functions);
  const selectors = signatures.reduce((acc: string[], val: string) => {
    if (val !== "init(bytes)") {
      acc.push(contract.interface.getSighash(val));
    }
    return acc;
  }, []);
  return selectors;
}

export function getSelector(func: string, ethers: any) {
  const abiInterface = new ethers.utils.Interface([func]);
  return abiInterface.getSighash(ethers.utils.Fragment.from(func));
}

interface ChainAddressMapping {
  [key: number]: {
    aavegotchiDiamond: string;
    forgeDiamond: string;
    realmDiamond: string;
    installationDiamond: string;
    tileDiamond: string;
    fakeGotchiCards: string;
    fakeGotchiArt: string;
    wearableDiamond: string;
  };
}

export const chainAddressesMap: ChainAddressMapping = {
  8453: {
    aavegotchiDiamond: "0xa99c4b08201f2913db8d28e71d020c4298f29dbf",
    wearableDiamond: "0x052e6c114a166B0e91C2340370d72D4C33752B4b",
    forgeDiamond: "0x50aF2d63b839aA32b4166FD1Cb247129b715186C",
    realmDiamond: "0x4B0040c3646D3c44B8a28Ad7055cfCF536c05372",
    installationDiamond: "0xebba5b725A2889f7f089a6cAE0246A32cad4E26b",
    tileDiamond: "0x617fdB8093b309e4699107F48812b407A7c37938",
    fakeGotchiCards: "0xe46B8902dAD841476d9Fee081F1d62aE317206A9",
    fakeGotchiArt: "0xAb59CA4A16925b0a4BaC5026C94bEB20A29Df479",
  },
  137: {
    aavegotchiDiamond: "0x86935F11C86623deC8a25696E1C19a8659CbF95d",
    wearableDiamond: "",
    forgeDiamond: "0x4fDfc1B53Fd1D80d969C984ba7a8CE4c7bAaD442",
    realmDiamond: "0x1D0360BaC7299C86Ec8E99d0c1C9A95FEfaF2a11",
    installationDiamond: "0x19f870bD94A34b3adAa9CaA439d333DA18d6812A",
    tileDiamond: "0x9216c31d8146bCB3eA5a9162Dc1702e8AEDCa355",
    fakeGotchiCards: "0x9f6BcC63e86D44c46e85564E9383E650dc0b56D7",
    fakeGotchiArt: "0xA4E3513c98b30d4D7cc578d2C328Bd550725D1D0",
  },
};

export const maticDiamondUpgrader =
  "0x01F010a5e001fe9d6940758EA5e8c777885E351e";

export const itemManager = "0x01F010a5e001fe9d6940758EA5e8c777885E351e";

export const itemManagerAlt = "0x8D46fd7160940d89dA026D59B2e819208E714E82";

export const gameManager = "0xa370f2ADd2A9Fba8759147995d6A0641F8d7C119";

export const maticRealmDiamondAddress = "";

export const maticInstallationDiamondAddress =
  "0x19f870bD94A34b3adAa9CaA439d333DA18d6812A";
export const maticTileDiamondAddress =
  "0x9216c31d8146bCB3eA5a9162Dc1702e8AEDCa355";

export const maticFakeGotchiCards =
  "0x9f6BcC63e86D44c46e85564E9383E650dc0b56D7";

export const maticFakeGotchiArt = "0xA4E3513c98b30d4D7cc578d2C328Bd550725D1D0";

export const maticForgeDiamond = "0x4fDfc1B53Fd1D80d969C984ba7a8CE4c7bAaD442";

export const baseDiamondAddress = "0xa99c4b08201f2913db8d28e71d020c4298f29dbf";

export async function diamondOwner(address: string, ethers: any) {
  return await (await ethers.getContractAt("OwnershipFacet", address)).owner();
}

export async function getFunctionsForFacet(
  facetAddress: string,
  ethers: any,
  diamondAddress: string
) {
  const Loupe = (await ethers.getContractAt(
    "DiamondLoupeFacet",
    diamondAddress
  )) as DiamondLoupeFacet;
  const functions = await Loupe.facetFunctionSelectors(facetAddress);
  return functions;
}

export async function getDiamondSigner(
  hre: HardhatRuntimeEnvironment,
  override?: string,
  useLedger?: boolean,
  diamondAddress?: string
) {
  //Instantiate the Signer
  const owner = await (
    (await hre.ethers.getContractAt(
      "OwnershipFacet",
      diamondAddress || chainAddressesMap[8453].aavegotchiDiamond
    )) as OwnershipFacet
  ).owner();
  const testing = ["hardhat", "localhost"].includes(hre.network.name);

  if (testing) {
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [override ? override : owner],
    });
    return await hre.ethers.getSigner(override ? override : owner);
  } else if (hre.network.name === "matic") {
    console.log("Diamond signer - Matic");

    return (await hre.ethers.getSigners())[0];
  } else if (hre.network.name === "tenderly") {
    return (await hre.ethers.getSigners())[0];
  } else {
    throw Error("Incorrect network selected");
  }
}

// export interface rfRankingScore {
//   rfType: string;
//   gotchiId: string;
//   score: number;
// }

// export async function getRfSznTypeRanking(rounds: string[][], _rfType: string) {
//   console.log("*** " + _rfType + " ***");
//   const idsArray: number[] = [];

//   let ranking = await setRfTypeObject(rounds[0], _rfType);

//   for (let i = 1; i < rounds.length; i++) {
//     ranking = await compareScoreArrays(ranking, rounds[i], _rfType);
//   }

//   const finalRanking: rfRankingScore[] = ranking.sort((a, b) => {
//     if (a.score > b.score) {
//       return 1;
//     } else if (a.score < b.score) {
//       return -1;
//     } else {
//       return 0;
//     }
//   });
//   // console.log(_rfType + " : " + finalRanking);
//   for (let x = 0; x < finalRanking.length; x++) {
//     idsArray.push(Number(finalRanking[x].gotchiId));
//   }
//   return idsArray;
// }

// export async function setRfTypeObject(rnd: string[], _rfType: string) {
//   const ranking = [];

//   for (let i = 0; i < rnd.length; i++) {
//     let score: rfRankingScore = {
//       rfType: _rfType,
//       gotchiId: rnd[i],
//       score: i,
//     };
//     ranking.push(score);
//   }
//   return ranking;
// }

// export async function compareScoreArrays(
//   arr1: rfRankingScore[],
//   arr2: string[],
//   _rfType: string
// ) {
//   for (let i = 0; i < arr1.length; i++) {
//     if (arr2.includes(arr1[i].gotchiId)) {
//       arr1[i].score += arr2.indexOf(arr1[i].gotchiId);
//     }
//   }
//   return arr1;
// }

export function rankIds(arrays: string[][], tiebreaker: number[]): string[] {
  let rankings: string[] = [];
  let assigned: { [key: string]: boolean } = {};
  let pending: string[] = [];

  for (let i = 0; i < arrays[0].length; i++) {
    let counts: { [key: string]: number } = {};

    // Count the frequency of each ID at this index
    arrays.forEach((array) => {
      let id = array[i];
      counts[id] = (counts[id] || 0) + 1;
    });

    // Sort the IDs based on frequency and tiebreaker ranking
    let sortedIds = Object.keys(counts).sort((a, b) => {
      if (counts[b] - counts[a] !== 0) {
        return counts[b] - counts[a];
      } else {
        return tiebreaker.indexOf(Number(a)) - tiebreaker.indexOf(Number(b));
      }
    });

    // Check if there are any pending IDs with a higher frequency at this index
    let pendingId = pending.find((id) => counts[id] > counts[sortedIds[0]]);
    if (pendingId) {
      rankings[i] = pendingId;
      assigned[pendingId] = true;
      pending = pending.filter((id) => id !== pendingId);
    } else {
      // Assign the highest ranked ID to this index, if it hasn't been assigned yet
      for (let id of sortedIds) {
        if (!assigned[id]) {
          rankings[i] = id;
          assigned[id] = true;
          break;
        }
      }
    }

    // Add the remaining IDs to the pending list
    pending = pending.concat(sortedIds.filter((id) => !assigned[id]));
  }

  // Fill any remaining indices with the remaining IDs in the tiebreaker order
  for (let i = 0; i < arrays[0].length; i++) {
    if (!rankings[i]) {
      for (let id of tiebreaker) {
        if (!assigned[id]) {
          rankings[i] = String(id);
          assigned[id] = true;
          break;
        }
      }
    }
  }
  console.log(rankings);
  return rankings;
}

export async function getPlaayersIds(round: string[][]) {
  console.log("*** RAANKED ***");
  const array: string[] = round[0];

  for (let i = 0; i < round.length; i++) {
    for (let x = 0; x < round[i].length; x++) {
      if (!array.includes(round[i][x])) {
        array.push(round[i][x]);
      }
    }
  }
  return array;
}

export async function hasDuplicateGotchiIds(_array: string[]) {
  let valuesSoFar = Object.create(null);
  for (let i = 0; i < _array.length; ++i) {
    let value = _array[i];
    if (value in valuesSoFar) {
      return true;
    }
    valuesSoFar[value] = true;
  }
  return false;
}

export function propType(title: string): "coreprop" | "sigprop" {
  if (title.includes("AGIP")) {
    return "coreprop";
  } else {
    return "sigprop";
  }
}

export interface RelayerInfo {
  apiKey: string;
  apiSecret: string;
}

export const baseSepoliaRelayerAddress =
  "0x39e86c0e02076E83694083e2eb48B510B3a96E4e";
export const baseRelayerAddress = "0xf52398257A254D541F392667600901f710a006eD";

export async function getRelayerSigner(hre: HardhatRuntimeEnvironment) {
  const testing = ["hardhat", "localhost"].includes(hre.network.name);
  let relayerAddress;
  if (hre.network.config.chainId === 8453) {
    relayerAddress = baseRelayerAddress;
  } else if (hre.network.config.chainId === 84532) {
    relayerAddress = baseSepoliaRelayerAddress;
  }

  if (testing) {
    relayerAddress = baseRelayerAddress;

    console.log("Using Hardhat");

    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [relayerAddress],
    });
    await hre.network.provider.request({
      method: "hardhat_setBalance",
      params: [relayerAddress, "0x100000000000000000000000"],
    });
    return await hre.ethers.provider.getSigner(relayerAddress);

    //we assume same defender for base mainnet
  } else if (hre.network.name === "matic" || hre.network.name === "base") {
    console.log(`USING ${hre.network.name}`);

    const credentials: RelayerInfo = {
      apiKey: process.env.DEFENDER_APIKEY!,
      apiSecret: process.env.DEFENDER_SECRET!,
    };

    const provider = new DefenderRelayProvider(credentials);
    return new DefenderRelaySigner(credentials, provider, {
      speed: "safeLow",
      validForSeconds: 200,
    });
  } else if (hre.network.name === "baseSepolia") {
    console.log("USING BASE SEPOLIA DEFENDER");
    const credentials: RelayerInfo = {
      apiKey: process.env.DEFENDER_APIKEY_BASESEPOLIA!,
      apiSecret: process.env.DEFENDER_SECRET_BASESEPOLIA!,
    };

    const provider = new DefenderRelayProvider(credentials);
    return new DefenderRelaySigner(credentials, provider, {
      speed: "average",
      validForSeconds: 180,
    });
  } else if (
    ["tenderly", "polter", "amoy", "geist"].includes(hre.network.name)
  ) {
    //impersonate
    return (await hre.ethers.getSigners())[0];
  } else {
    throw Error("Incorrect network selected");
  }
}

export async function getLedgerSigner(ethers: any) {
  console.log("Getting ledger signer");
  return new LedgerSigner(ethers.provider, "m/44'/60'/1'/0/0");
}

export function logXPRecipients(
  propType: "sigprop" | "coreprop",
  title: string,
  tokenIds: string[],
  addresses: string[]
) {
  const parentDir = `data/XPRecipients/${propType}`;
  const parentFile = `${parentDir}/${title}.json`;
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
  }
  if (!fs.existsSync(parentFile)) {
    const data = {
      tokenIds,
      addresses,
    };

    fs.writeFileSync(parentFile, JSON.stringify(data));
    console.log("finished writing to file");
  }
}

export async function verifyContract(
  address: string,
  withArgs: boolean = false,
  args?: any[],
  contractName?: string
) {
  //only try to verify if it is a live network

  //@ts-ignore
  if (["localhost", "hardhat"].includes(hre.network.name)) {
    console.log("Skipping verification on local network");
    return;
  }

  console.log(`Attempting to verify contract at ${address}...`);
  //wait 5 seconds because of base mainnet lags
  console.log("Waiting 5 seconds for base mainnet to catch up...");
  await delay(5000);

  try {
    const verifyArgs: any = {
      address,
    };

    if (withArgs && args) {
      verifyArgs.constructorArguments = args;
    }

    if (contractName) {
      verifyArgs.contract = contractName;
    }

    //@ts-ignore
    await hre.run("verify:verify", verifyArgs);
    console.log(`Successfully verified contract ${address}`);
  } catch (error: any) {
    const msg = error?.message || "";
    if (
      msg.includes("Already Verified") ||
      msg.includes("ContractAlreadyVerified") || // Added to catch Etherscan's newer message
      msg.includes("already verified") || // General catch
      msg.includes("Contract source code already verified") // Another Etherscan variant
    ) {
      console.log(
        `Contract ${address}${
          contractName ? " (" + contractName + ")" : ""
        } already verified on block explorer, skipping.`
      );
    } else {
      console.error(
        `Error verifying contract ${address}${
          contractName ? " (" + contractName + ")" : ""
        }:`,
        msg
      );
    }
  }
}

export function generateWearableGroups(itemIds: number[]) {
  function assertWearableGroupsExist(
    itemIds: number[],
    groups: Record<string, unknown[]>
  ) {
    for (let index = 0; index < itemIds.length; index++) {
      const itemId = itemIds[index];
      for (const [groupName, groupArr] of Object.entries(groups)) {
        if (!groupArr[index])
          throw new Error(`Wearable ${itemId} not found in ${groupName}`);
      }
    }
  }

  const sides = {
    wearables: wearablesFrontSvgs(),
    "wearables-left": wearablesLeftSvgs(),
    "wearables-right": wearablesRightSvgs(),
    "wearables-back": wearablesBackSvgs(),
  };

  const wearableGroups: Record<string, unknown[]> = {};

  Object.keys(sides).forEach((side) => {
    wearableGroups[side] = itemIds.map(
      (id) => sides[side as keyof typeof sides][id]
    );
  });

  assertWearableGroupsExist(itemIds, wearableGroups);

  return wearableGroups;
}

export function generateSleeveGroups(sleeveIds: number[]) {
  function assertSleeveGroupsExist(
    sleeveIds: number[],
    groups: Record<string, unknown[]>
  ) {
    for (let index = 0; index < sleeveIds.length; index++) {
      const sleeveId = sleeveIds[index];
      for (const [groupName, groupArr] of Object.entries(groups)) {
        if (!groupArr[index])
          throw new Error(`Sleeve ${sleeveId} not found in ${groupName}`);
      }
    }
  }

  const sleeveGroups = {
    sleeves: sleeveIds.map((s) => wearablesFrontSleeveSvgs[Number(s)]),
    "sleeves-left": sleeveIds.map(
      (sleeveId) => wearablesLeftSleeveSvgs[Number(sleeveId)]
    ),
    "sleeves-right": sleeveIds.map(
      (sleeveId) => wearablesRightSleeveSvgs[Number(sleeveId)]
    ),
    "sleeves-back": sleeveIds.map(
      (sleeveId) => wearablesBackSleeveSvgs[Number(sleeveId)]
    ),
  };

  assertSleeveGroupsExist(sleeveIds, sleeveGroups);

  return sleeveGroups;
}
