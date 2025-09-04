import { ethers } from "hardhat";
import { varsForNetwork } from "../helpers/constants";
import { getLedgerSigner } from "./helperFunctions";

async function main() {
  const c = await varsForNetwork(ethers);
  const aavegotchiFacet = await ethers.getContractAt(
    "AavegotchiFacet",
    c.aavegotchiDiamond!
  );
  const totalSupplyBn = 25000;

  const batchSize = 500;
  const gotchisWithStatus3: number[] = [];

  for (let start = 1; start <= totalSupplyBn; start += batchSize) {
    const end = Math.min(start + batchSize - 1, totalSupplyBn);
    const ids: number[] = [];
    for (let id = start; id <= end; id++) ids.push(id);

    const gotchis = await aavegotchiFacet.batchGetBridgedAavegotchi(ids);
    for (let i = 0; i < gotchis.length; i++) {
      const g: any = gotchis[i];
      const statusValue =
        g?.status && g.status.toNumber
          ? g.status.toNumber()
          : Number(g?.status);
      if (statusValue === 3) {
        //only push the tokenIds to the array
        gotchisWithStatus3.push(ids[i]);
      }
    }
  }

  console.log(`Fetched ${gotchisWithStatus3.length} gotchis with status === 3`);
  //console.log(gotchisWithStatus3);

  const signer = await getLedgerSigner(ethers);

  const CollateralFacet = await ethers.getContractAt(
    "CollateralFacet",
    c.aavegotchiDiamond!,
    signer
  );

  //call redeployTokenEscrows on batches of 40 gotchis
  for (let i = 0; i < gotchisWithStatus3.length; i += 50) {
    const batch = gotchisWithStatus3.slice(i, i + 50);
    console.log(
      `Redeploying batch ${i / 50 + 1} of ${gotchisWithStatus3.length / 50}`
    );
    const tx = await CollateralFacet.redeployTokenEscrows(batch);
    await tx.wait();
    console.log(`Batch ${i / 40 + 1} completed`);
  }
}

main();
