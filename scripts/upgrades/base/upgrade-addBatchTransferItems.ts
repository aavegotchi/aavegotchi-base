import { ethers, network, run } from "hardhat";
import {
  convertFacetAndSelectorsToString,
  DeployUpgradeTaskArgs,
  FacetsAndAddSelectors,
} from "../../../tasks/deployUpgrade";

import {
  diamondOwner,
  getLedgerSigner,
  impersonate,
  itemManager,
} from "../../helperFunctions";

import { varsForNetwork } from "../../../helpers/constants";
import {
  buildBatchSafeTransferFromArgsFromJson,
  TokenCommitmentData,
} from "../../getTokenCommitmentData";
import { PC_WALLET } from "../../geistBridge/paths";

export async function upgradeAddBatchTransferItems() {
  const c = await varsForNetwork(ethers);

  const facets: FacetsAndAddSelectors[] = [
    {
      facetName: "ItemsTransferFacet",
      addSelectors: [
        "function batchExtractItemsFromDiamond(address[] calldata _tos, uint256[][] calldata _ids, uint256[][] calldata _values) external",
      ],
      removeSelectors: [],
    },
  ];
  const joined = convertFacetAndSelectorsToString(facets);

  const args: DeployUpgradeTaskArgs = {
    diamondOwner: "0x01F010a5e001fe9d6940758EA5e8c777885E351e",
    diamondAddress: c.aavegotchiDiamond!,
    facetsAndAddSelectors: joined,
    useLedger: true,
    useMultisig: false,
    useRelayer: false,
  };

  await run("deployUpgrade", args);

  //add PC_WALLET as item and game manager

  const signer = await getLedgerSigner(ethers);

  let daoFacet = await ethers.getContractAt(
    "contracts/Aavegotchi/facets/DAOFacet.sol:DAOFacet",
    c.aavegotchiDiamond!,
    signer
  );

  //transfer tokens to owners

  const json: TokenCommitmentData = require("../../tokenCommitmentData.json");
  const payload = buildBatchSafeTransferFromArgsFromJson(json);

  let itemsTransferFacet = await ethers.getContractAt(
    "contracts/Aavegotchi/facets/ItemsTransferFacet.sol:ItemsTransferFacet",
    c.aavegotchiDiamond!,
    signer
  );

  let testing = ["hardhat", "localhost"].includes(network.name);
  if (testing) {
    const owner = await diamondOwner(c.aavegotchiDiamond!, ethers);
    itemsTransferFacet = await impersonate(
      owner,
      itemsTransferFacet,
      ethers,
      network
    );

    daoFacet = await impersonate(owner, daoFacet, ethers, network);
  }

  //add PC_WALLET as game and item manager
  let tx = await daoFacet.addGameManagers([PC_WALLET], [1000000]);
  console.log("addGameManager tx:", tx.hash);
  await tx.wait();
  tx = await daoFacet.addItemManagers([PC_WALLET]);
  console.log("addItemManager tx:", tx.hash);
  await tx.wait();

  tx = await itemsTransferFacet.batchExtractItemsFromDiamond(
    payload.tos,
    payload.ids,
    payload.values
  );
  console.log("batchExtractItemsFromDiamond tx:", tx.hash);
  await tx.wait();
}

if (require.main === module) {
  upgradeAddBatchTransferItems()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
