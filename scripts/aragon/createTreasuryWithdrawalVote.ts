import { ethers } from "ethers";
import * as dotenv from "dotenv";
import {
  AGT_TREASURY_DAO,
  buildAgtTreasuryWithdrawalVote,
  createAgtTreasuryWithdrawalVote,
} from "./agtTreasuryWithdrawalVote";

dotenv.config();

interface CliArgs {
  [key: string]: string | boolean | undefined;
}

function parseArgs(argv: string[]): CliArgs {
  const parsed: CliArgs = {};

  for (let i = 0; i < argv.length; i++) {
    const current = argv[i];
    if (!current.startsWith("--")) continue;

    const key = current.slice(2);
    const next = argv[i + 1];

    if (!next || next.startsWith("--")) {
      parsed[key] = true;
      continue;
    }

    parsed[key] = next;
    i += 1;
  }

  return parsed;
}

function requireStringArg(args: CliArgs, key: string): string {
  const value = args[key];
  if (!value || typeof value !== "string") {
    throw new Error(`Missing required argument --${key}`);
  }
  return value;
}

function getPrivateKey(args: CliArgs): string {
  const fromArgs = args["private-key"];
  const raw =
    (typeof fromArgs === "string" ? fromArgs : undefined) ||
    process.env.PRIVATE_KEY ||
    process.env.SECRET;

  if (!raw) {
    throw new Error("Missing private key. Pass --private-key or set PRIVATE_KEY/SECRET.");
  }

  return raw.startsWith("0x") ? raw : `0x${raw}`;
}

function getAmount(args: CliArgs) {
  const amountWei = args["amount-wei"];
  if (typeof amountWei === "string") {
    return ethers.BigNumber.from(amountWei);
  }

  const amount = requireStringArg(args, "amount");
  return ethers.utils.parseUnits(amount, 18);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const recipient = requireStringArg(args, "recipient");
  const amount = getAmount(args);
  const token =
    typeof args.token === "string" ? args.token : AGT_TREASURY_DAO.dai;
  const metadata =
    typeof args.metadata === "string"
      ? args.metadata
      : `Withdraw ${ethers.utils.formatUnits(amount, 18)} DAI from Treasury 2`;
  const reference =
    typeof args.reference === "string" ? args.reference : metadata;

  const built = buildAgtTreasuryWithdrawalVote({
    recipient,
    amount,
    metadata,
    reference,
    token,
  });

  console.log("Treasury withdrawal vote payload");
  console.log(JSON.stringify({
    tokenManager: AGT_TREASURY_DAO.tokenManager,
    voting: AGT_TREASURY_DAO.voting,
    finance: AGT_TREASURY_DAO.finance,
    token,
    recipient,
    amountWei: amount.toString(),
    metadata,
    reference,
    tx: built.tx,
    executionScript: built.executionScript,
    forwardScript: built.forwardScript,
  }, null, 2));

  if (!args.broadcast) {
    console.log("\nDry run only. Re-run with --broadcast to submit the vote.");
    return;
  }

  const rpcUrl =
    (typeof args["rpc-url"] === "string" ? args["rpc-url"] : undefined) ||
    process.env.MAINNET_URL;
  if (!rpcUrl) {
    throw new Error("Missing rpc url. Pass --rpc-url or set MAINNET_URL.");
  }

  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(getPrivateKey(args), provider);

  const tx = await createAgtTreasuryWithdrawalVote(signer, {
    recipient,
    amount,
    metadata,
    reference,
    token,
  });

  console.log(`\nSubmitted transaction: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`Mined in block ${receipt.blockNumber}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
