import { ethers } from "hardhat";

async function main() {
  // Configuration
  const GHST_ADDRESS = "0xcD2F22236DD9Dfe2356D7C543161D4d260FD9BcB";
  const RICH_ADDRESS = "0x01F010a5e001fe9d6940758EA5e8c777885E351e"; // Address to impersonate
  const GHST_AMOUNT = ethers.utils.parseUnits("20000", 18); // 20,000 GHST tokens
  const ETH_AMOUNT = ethers.utils.parseEther("10"); // 10 ETH

  // Target address to send tokens and ETH to
  const TARGET_ADDRESS = "0x9A4F88587437eaF372088CbEff5156FF8307961c"; // Hardhat account #0

  console.log("Starting impersonation and transfer script...");
  console.log(`Target address: ${TARGET_ADDRESS}`);
  console.log(`GHST amount: ${ethers.utils.formatUnits(GHST_AMOUNT, 18)}`);
  console.log(`ETH amount: ${ethers.utils.formatEther(ETH_AMOUNT)}`);

  // Get signers
  const [signer1] = await ethers.getSigners();
  console.log(`Hardhat signer 1: ${signer1.address}`);

  // Impersonate the rich address
  await ethers.provider.send("hardhat_impersonateAccount", [RICH_ADDRESS]);
  console.log(`Impersonating address: ${RICH_ADDRESS}`);

  // Give the impersonated account some ETH for gas
  await ethers.provider.send("hardhat_setBalance", [
    RICH_ADDRESS,
    "0x56BC75E2D630E0000", // 100 ETH in hex
  ]);

  // Get the impersonated signer
  const impersonatedSigner = await ethers.getSigner(RICH_ADDRESS);

  // GHST contract interface
  const ghstAbi = [
    "function transfer(address to, uint256 amount) external returns (bool)",
    "function balanceOf(address account) external view returns (uint256)",
    "function symbol() external view returns (string)",
    "function decimals() external view returns (uint8)",
  ];

  // Connect to GHST contract
  const ghstContract = new ethers.Contract(
    GHST_ADDRESS,
    ghstAbi,
    impersonatedSigner
  );

  try {
    // Check GHST balance before transfer
    const balanceBefore = await ghstContract.balanceOf(RICH_ADDRESS);
    console.log(
      `GHST balance before transfer: ${ethers.utils.formatUnits(
        balanceBefore,
        18
      )}`
    );

    if (balanceBefore.lt(GHST_AMOUNT)) {
      console.log("Warning: Insufficient GHST balance for transfer");
      console.log(
        `Available: ${ethers.utils.formatUnits(balanceBefore, 18)} GHST`
      );
      console.log(
        `Required: ${ethers.utils.formatUnits(GHST_AMOUNT, 18)} GHST`
      );
    }

    // Transfer GHST tokens
    console.log("Transferring GHST tokens...");
    const ghstTx = await ghstContract.transfer(TARGET_ADDRESS, GHST_AMOUNT);
    await ghstTx.wait();
    console.log(`✅ GHST transfer successful! Hash: ${ghstTx.hash}`);

    // Check GHST balance after transfer
    const balanceAfter = await ghstContract.balanceOf(RICH_ADDRESS);
    const targetBalance = await ghstContract.balanceOf(TARGET_ADDRESS);
    console.log(
      `GHST balance after transfer: ${ethers.utils.formatUnits(
        balanceAfter,
        18
      )}`
    );
    console.log(
      `Target GHST balance: ${ethers.utils.formatUnits(targetBalance, 18)}`
    );
  } catch (error) {
    console.error("Error transferring GHST:", error);
  }

  try {
    // Transfer ETH from hardhat signer 1 to target address
    console.log("Transferring ETH from hardhat signer 1...");
    const ethTx = await signer1.sendTransaction({
      to: TARGET_ADDRESS,
      value: ETH_AMOUNT,
    });
    await ethTx.wait();
    console.log(`✅ ETH transfer successful! Hash: ${ethTx.hash}`);

    // Check ETH balances
    const targetEthBalance = await ethers.provider.getBalance(TARGET_ADDRESS);
    console.log(
      `Target ETH balance: ${ethers.utils.formatEther(targetEthBalance)} ETH`
    );
  } catch (error) {
    console.error("Error transferring ETH:", error);
  }

  // Stop impersonating
  await ethers.provider.send("hardhat_stopImpersonatingAccount", [
    RICH_ADDRESS,
  ]);
  console.log("Stopped impersonating account");

  console.log("Script completed!");
}

// Execute the script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
