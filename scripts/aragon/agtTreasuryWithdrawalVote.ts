import { BigNumberish, Signer, providers, utils } from "ethers";

export interface CallScriptAction {
  to: string;
  data: string;
}

export interface AgtTreasuryDaoConfig {
  tokenManager: string;
  voting: string;
  finance: string;
  vault: string;
  dai: string;
  agt: string;
}

export interface BuildAgtTreasuryWithdrawalVoteParams {
  recipient: string;
  amount: BigNumberish;
  metadata: string;
  reference: string;
  token?: string;
}

export interface BuiltAgtTreasuryWithdrawalVote {
  paymentCalldata: string;
  executionScript: string;
  newVoteCalldata: string;
  forwardScript: string;
  tx: providers.TransactionRequest;
}

export const CALLS_SCRIPT_SPEC_ID = "0x00000001";

export const AGT_TREASURY_DAO: AgtTreasuryDaoConfig = {
  tokenManager: utils.getAddress("0x8eFea71B63DB02C00229794d90ec4ba8ecD4Ea81"),
  voting: utils.getAddress("0x93CF86a83bAA323407857C0A25e768869E12C721"),
  finance: utils.getAddress("0x4f5762334100f6a80d35a616ef9df71b0452cf44"),
  vault: utils.getAddress("0xFFE6280ae4E864D9aF836B562359FD828EcE8020"),
  dai: utils.getAddress("0x6B175474E89094C44Da98b954EedeAC495271d0F"),
  agt: utils.getAddress("0xb677136aC25e5e8763Eaf7f80D54de7D86313546"),
};

const financeInterface = new utils.Interface([
  "function newImmediatePayment(address,address,uint256,string)",
]);
const votingInterface = new utils.Interface([
  "function newVote(bytes,string,bool,bool)",
]);
const tokenManagerInterface = new utils.Interface([
  "function forward(bytes evmScript)",
]);

export function encodeCallScript(actions: CallScriptAction[]): string {
  const encodedActions = actions.map((action) => {
    const target = utils.getAddress(action.to).slice(2).toLowerCase();
    const dataLength = utils
      .hexZeroPad(utils.hexlify(utils.hexDataLength(action.data)), 4)
      .slice(2);

    return `${target}${dataLength}${action.data.slice(2)}`;
  });

  return `${CALLS_SCRIPT_SPEC_ID}${encodedActions.join("")}`;
}

export function decodeCallScript(script: string): CallScriptAction[] {
  if (!script.startsWith(CALLS_SCRIPT_SPEC_ID)) {
    throw new Error("Unsupported EVMScript spec");
  }

  const actions: CallScriptAction[] = [];
  let offset = CALLS_SCRIPT_SPEC_ID.length;

  while (offset < script.length) {
    const to = utils.getAddress(`0x${script.slice(offset, offset + 40)}`);
    offset += 40;

    const length = parseInt(script.slice(offset, offset + 8), 16);
    offset += 8;

    const data = `0x${script.slice(offset, offset + length * 2)}`;
    offset += length * 2;

    actions.push({ to, data });
  }

  return actions;
}

export function buildAgtTreasuryWithdrawalVote(
  params: BuildAgtTreasuryWithdrawalVoteParams
): BuiltAgtTreasuryWithdrawalVote {
  const token = utils.getAddress(params.token ?? AGT_TREASURY_DAO.dai);
  const recipient = utils.getAddress(params.recipient);

  const paymentCalldata = financeInterface.encodeFunctionData(
    "newImmediatePayment(address,address,uint256,string)",
    [token, recipient, params.amount, params.reference]
  );

  const executionScript = encodeCallScript([
    { to: AGT_TREASURY_DAO.finance, data: paymentCalldata },
  ]);

  const newVoteCalldata = votingInterface.encodeFunctionData(
    "newVote(bytes,string,bool,bool)",
    [executionScript, params.metadata, false, true]
  );

  const forwardScript = encodeCallScript([
    { to: AGT_TREASURY_DAO.voting, data: newVoteCalldata },
  ]);

  return {
    paymentCalldata,
    executionScript,
    newVoteCalldata,
    forwardScript,
    tx: {
      to: AGT_TREASURY_DAO.tokenManager,
      data: tokenManagerInterface.encodeFunctionData("forward", [forwardScript]),
      value: 0,
    },
  };
}

export async function createAgtTreasuryWithdrawalVote(
  signer: Signer,
  params: BuildAgtTreasuryWithdrawalVoteParams
) {
  const built = buildAgtTreasuryWithdrawalVote(params);
  return signer.sendTransaction(built.tx);
}
