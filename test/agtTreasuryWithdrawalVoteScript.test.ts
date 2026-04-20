import { ethers, network } from "hardhat";
import { expect } from "chai";
import {
  AGT_TREASURY_DAO,
  buildAgtTreasuryWithdrawalVote,
  createAgtTreasuryWithdrawalVote,
  decodeCallScript,
} from "../scripts/aragon/agtTreasuryWithdrawalVote";

const PROPOSER = "0x027ffd3c119567e85998f4e6b9c3d83d5702660c";
const RECIPIENT = "0x1111111111111111111111111111111111111111";
const AMOUNT = "275000";
const METADATA = "Withdraw DAI from Treasury 2";
const REFERENCE = "Treasury 2 DAI withdrawal";

const votingAbi = [
  "event StartVote(uint256 indexed voteId, address indexed creator, string metadata)",
  "function votesLength() view returns (uint256)",
  "function getVote(uint256 voteId) view returns (bool open, bool executed, uint64 startDate, uint64 snapshotBlock, uint64 supportRequired, uint64 minAcceptQuorum, uint256 yea, uint256 nay, uint256 votingPower, bytes script)",
];

const tokenManagerAbi = [
  "function canForward(address sender, bytes evmScript) view returns (bool)",
];

describe("AGT treasury withdrawal vote script", function () {
  this.timeout(300000);

  it("builds the expected nested Aragon scripts", async function () {
    const built = buildAgtTreasuryWithdrawalVote({
      recipient: RECIPIENT,
      amount: ethers.utils.parseUnits(AMOUNT, 18),
      metadata: METADATA,
      reference: REFERENCE,
    });

    expect(built.tx.to).to.equal(AGT_TREASURY_DAO.tokenManager);

    const [outerAction] = decodeCallScript(built.forwardScript);
    expect(outerAction.to).to.equal(AGT_TREASURY_DAO.voting);

    const votingInterface = new ethers.utils.Interface([
      "function newVote(bytes,string,bool,bool)",
    ]);
    const [innerScript, metadata, castVote, executesIfDecided] =
      votingInterface.decodeFunctionData("newVote(bytes,string,bool,bool)", outerAction.data);

    expect(metadata).to.equal(METADATA);
    expect(castVote).to.equal(false);
    expect(executesIfDecided).to.equal(true);
    expect(innerScript).to.equal(built.executionScript);

    const [financeAction] = decodeCallScript(built.executionScript);
    expect(financeAction.to).to.equal(AGT_TREASURY_DAO.finance);

    const financeInterface = new ethers.utils.Interface([
      "function newImmediatePayment(address,address,uint256,string)",
    ]);
    const [token, receiver, amount, reference] = financeInterface.decodeFunctionData(
      "newImmediatePayment(address,address,uint256,string)",
      financeAction.data
    );

    expect(token).to.equal(AGT_TREASURY_DAO.dai);
    expect(receiver).to.equal(RECIPIENT);
    expect(amount).to.equal(ethers.utils.parseUnits(AMOUNT, 18));
    expect(reference).to.equal(REFERENCE);
  });

  it("creates a real AGT treasury vote through the token manager on an Ethereum fork", async function () {
    if (!process.env.MAINNET_URL) {
      throw new Error("MAINNET_URL is required for the AGT treasury vote fork test");
    }

    const forking: { jsonRpcUrl: string; blockNumber?: number } = {
      jsonRpcUrl: process.env.MAINNET_URL,
    };
    if (process.env.MAINNET_FORK_BLOCK) {
      forking.blockNumber = Number(process.env.MAINNET_FORK_BLOCK);
    }

    await network.provider.request({
      method: "hardhat_reset",
      params: [{ forking }],
    });

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [PROPOSER],
    });
    await network.provider.request({
      method: "hardhat_setBalance",
      params: [PROPOSER, "0x1000000000000000000000"],
    });

    const signer = await ethers.getSigner(PROPOSER);
    const voting = new ethers.Contract(AGT_TREASURY_DAO.voting, votingAbi, ethers.provider);
    const tokenManager = new ethers.Contract(
      AGT_TREASURY_DAO.tokenManager,
      tokenManagerAbi,
      ethers.provider
    );

    const built = buildAgtTreasuryWithdrawalVote({
      recipient: RECIPIENT,
      amount: ethers.utils.parseUnits(AMOUNT, 18),
      metadata: METADATA,
      reference: REFERENCE,
    });

    expect(await tokenManager.canForward(PROPOSER, built.forwardScript)).to.equal(true);

    const beforeVotes = await voting.votesLength();
    const receipt = await (
      await createAgtTreasuryWithdrawalVote(signer, {
        recipient: RECIPIENT,
        amount: ethers.utils.parseUnits(AMOUNT, 18),
        metadata: METADATA,
        reference: REFERENCE,
      })
    ).wait();
    const afterVotes = await voting.votesLength();

    expect(afterVotes).to.equal(beforeVotes.add(1));

    const voteId = afterVotes.sub(1);
    const startVoteLog = receipt.logs
      .map((log: any) => {
        try {
          return voting.interface.parseLog(log);
        } catch (error) {
          return undefined;
        }
      })
      .find((parsed: any) => parsed && parsed.name === "StartVote");

    expect(startVoteLog?.args.voteId).to.equal(voteId);
    expect(startVoteLog?.args.creator).to.equal(AGT_TREASURY_DAO.tokenManager);
    expect(startVoteLog?.args.metadata).to.equal(METADATA);

    const storedVote = await voting.getVote(voteId);
    expect(storedVote.script).to.equal(built.executionScript);
  });
});
