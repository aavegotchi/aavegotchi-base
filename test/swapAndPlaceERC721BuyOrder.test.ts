import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers, network } from "hardhat";
import { upgradeAddSwapAndBuyOrders } from "../scripts/upgrades/upgrade-addSwapAndBuyOrders";

async function impersonateAccount(address: string) {
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [address],
  });
  return ethers.getSigner(address);
}

const ADDRESSES = {
  DIAMOND: "0xA99c4B08201F2913Db8D28e71d020c4298F29dBF",
  GHST_TOKEN: "0xcd2f22236dd9dfe2356d7c543161d4d260fd9bcb",
  USDC_TOKEN: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  Z_ROUTER: "0x0000000000404FECAf36E6184245475eE1254835",
  WHALE_USDC: "0x1985EA6E9c68E1C272d8209f3B478AC2Fdb25c87",
} as const;

interface ERC721BuyOrderSummary {
  id: string;
  category: string;
  erc721TokenAddress: string;
  erc721TokenId: string;
  priceInWei: string;
  duration: string | null;
}

interface ERC721BuyOrdersResponse {
  erc721BuyOrders: ERC721BuyOrderSummary[];
}

describe("SwapAndPlaceERC721BuyOrder Integration Test", function () {
  let deployer: any;
  let buyOrderSwapFacet: any;
  let erc721BuyOrderFacet: any;
  const erc721BuyOrderInterface = new ethers.utils.Interface([
    "event ERC721BuyOrderAdded(uint256 indexed buyOrderId,address indexed buyer,address erc721TokenAddress,uint256 erc721TokenId,uint256 indexed category,uint256 priceInWei,uint256 duration,bytes32 validationHash,uint256 time)",
  ]);
  let erc721MarketplaceFacet: any;
  let activeOrder: ERC721BuyOrderSummary;

  before(async function () {
    const isHardhat = network.name === "hardhat";
    const isLocalhost = network.name === "localhost";

    if (!isHardhat && !isLocalhost) {
      this.skip();
    }

    [deployer] = await ethers.getSigners();

    if (isHardhat) {
      await network.provider.request({
        method: "hardhat_reset",
        params: [
          {
            forking: {
              jsonRpcUrl: "https://mainnet.base.org",
            },
          },
        ],
      });
    }

    await upgradeAddSwapAndBuyOrders();

    const BuyOrderSwapFacet = await ethers.getContractFactory(
      "BuyOrderSwapFacet"
    );
    buyOrderSwapFacet = BuyOrderSwapFacet.attach(ADDRESSES.DIAMOND);

    erc721MarketplaceFacet = await ethers.getContractAt(
      "ERC721MarketplaceFacet",
      ADDRESSES.DIAMOND
    );

    erc721BuyOrderFacet = await ethers.getContractAt(
      "ERC721BuyOrderFacet",
      ADDRESSES.DIAMOND
    );

    const zRouterCode = await ethers.provider.getCode(ADDRESSES.Z_ROUTER);
    if (zRouterCode === "0x") {
      throw new Error(`zRouter not found at ${ADDRESSES.Z_ROUTER}`);
    }

    const ghstCode = await ethers.provider.getCode(ADDRESSES.GHST_TOKEN);
    if (ghstCode === "0x") {
      throw new Error(`GHST token not found at ${ADDRESSES.GHST_TOKEN}`);
    }

    activeOrder = await fetchActiveBuyOrder();
  });

  async function fetchActiveBuyOrder(): Promise<ERC721BuyOrderSummary> {
    const query = `
      query {
        erc721BuyOrders(
          first: 10
          where: { cancelled: false, priceInWei_gt: "0", executedAt: "0" }
          orderBy: priceInWei
          orderDirection: asc
        ) {
          id
          category
          erc721TokenAddress
          erc721TokenId
          priceInWei
          duration
        }
      }
    `;

    try {
      const response = await fetch(
        "https://subgraph.satsuma-prod.com/tWYl5n5y04oz/aavegotchi/aavegotchi-core-base/api",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ query }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: { data: ERC721BuyOrdersResponse } = await response.json();

      if (!data.data?.erc721BuyOrders?.length) {
        throw new Error("No active ERC721 buy orders found");
      }

      return data.data.erc721BuyOrders[0];
    } catch (error) {
      return {
        id: "0",
        category: "0",
        erc721TokenAddress: ADDRESSES.DIAMOND,
        erc721TokenId: "1",
        priceInWei: ethers.utils.parseEther("50").toString(),
        duration: "0",
      };
    }
  }

  it("swaps USDC for GHST and places an ERC721 buy order", async function () {
    const priceInWei = BigNumber.from(activeOrder.priceInWei);
    const duration = activeOrder.duration
      ? BigNumber.from(activeOrder.duration)
      : BigNumber.from(0);

    const ghstToUsdcRate = ethers.utils.parseUnits("0.46", 6);
    const swapAmount = priceInWei
      .mul(ghstToUsdcRate)
      .div(ethers.utils.parseEther("1"))
      .mul(3);

    await impersonateAccount(ADDRESSES.WHALE_USDC);
    const usdcWhale = await ethers.getSigner(ADDRESSES.WHALE_USDC);

    const usdcToken = await ethers.getContractAt(
      "contracts/shared/interfaces/IERC20.sol:IERC20",
      ADDRESSES.USDC_TOKEN
    );
    const ghstToken = await ethers.getContractAt(
      "contracts/shared/interfaces/IERC20.sol:IERC20",
      ADDRESSES.GHST_TOKEN
    );

    const whaleBalance = await usdcToken.balanceOf(ADDRESSES.WHALE_USDC);
    const transferAmount = whaleBalance.gt(swapAmount)
      ? swapAmount
      : whaleBalance;

    await usdcToken
      .connect(usdcWhale)
      .transfer(deployer.address, transferAmount);
    await usdcToken
      .connect(deployer)
      .approve(ADDRESSES.DIAMOND, transferAmount);

    const initialUsdcBalance = await usdcToken.balanceOf(deployer.address);
    const initialDiamondGhst = await ghstToken.balanceOf(ADDRESSES.DIAMOND);

    let category = BigNumber.from(activeOrder.category);
    try {
      category = await erc721MarketplaceFacet.getERC721Category(
        activeOrder.erc721TokenAddress,
        BigNumber.from(activeOrder.erc721TokenId)
      );
    } catch (error) {
      // Fallback to subgraph category if direct call fails (e.g. mock data)
    }

    const params = {
      tokenIn: ADDRESSES.USDC_TOKEN,
      swapAmount: transferAmount,
      minGhstOut: priceInWei,
      swapDeadline: Math.floor(Date.now() / 1000) + 3600,
      buyOrderId: 0,
      erc721TokenAddress: activeOrder.erc721TokenAddress,
      erc721TokenId: BigNumber.from(activeOrder.erc721TokenId),
      category,
      priceInWei,
      duration,
      recipient: deployer.address,
    };

    const validationOptions = [false, false, false];

    console.log("\n=== BUY ORDER (ERC721) INPUTS ===");
    console.log("TokenIn:", params.tokenIn);
    console.log("erc721TokenAddress:", params.erc721TokenAddress);
    console.log("erc721TokenId:", params.erc721TokenId.toString());
    console.log("category:", params.category.toString());
    console.log("priceInWei (GHST):", ethers.utils.formatEther(priceInWei));
    console.log("duration:", duration.toString());
    console.log("recipient:", params.recipient);
    console.log(
      "swapAmount (USDC):",
      ethers.utils.formatUnits(params.swapAmount, 6)
    );
    console.log(
      "minGhstOut (GHST):",
      ethers.utils.formatEther(params.minGhstOut)
    );
    console.log("deadline:", params.swapDeadline);
    console.log(
      "USDC balance (before):",
      ethers.utils.formatUnits(initialUsdcBalance, 6)
    );

    const tx = await buyOrderSwapFacet
      .connect(deployer)
      .swapAndPlaceERC721BuyOrder(params, validationOptions);
    const receipt = await tx.wait();

    const diamondGhstAfter = await ghstToken.balanceOf(ADDRESSES.DIAMOND);
    console.log(
      "Diamond GHST before:",
      ethers.utils.formatEther(initialDiamondGhst)
    );
    console.log(
      "Diamond GHST after:",
      ethers.utils.formatEther(diamondGhstAfter)
    );
    console.log(
      "Diamond GHST delta (order funded):",
      ethers.utils.formatEther(diamondGhstAfter.sub(initialDiamondGhst))
    );

    // Decode and log swap event for GHST received
    const swapEvtTopic = buyOrderSwapFacet.interface.getEventTopic(
      "SwapAndPlaceERC721BuyOrder"
    );
    const swapEvt = receipt.logs.find((l: any) => l.topics[0] === swapEvtTopic);
    if (swapEvt) {
      const decodedSwap = buyOrderSwapFacet.interface.decodeEventLog(
        "SwapAndPlaceERC721BuyOrder",
        swapEvt.data,
        swapEvt.topics
      );
      console.log(
        "GHST received from swap:",
        ethers.utils.formatEther(decodedSwap.ghstReceived)
      );
      console.log(
        "BuyOrderId (from swap evt):",
        decodedSwap.buyOrderId.toString()
      );

      // Parse last GHST Transfer (refund) from receipt logs
      const erc20Iface = new ethers.utils.Interface([
        "event Transfer(address indexed from,address indexed to,uint256 value)",
      ]);
      const transferTopic = erc20Iface.getEventTopic("Transfer");
      const ghstLogs = receipt.logs.filter(
        (l: any) =>
          l.address.toLowerCase() === ADDRESSES.GHST_TOKEN.toLowerCase() &&
          l.topics[0] === transferTopic
      );
      const lastGhstLog = ghstLogs[ghstLogs.length - 1];
      if (lastGhstLog) {
        const parsed = erc20Iface.decodeEventLog(
          "Transfer",
          lastGhstLog.data,
          lastGhstLog.topics
        );
        const refundAmount = parsed.value as BigNumber;
        console.log(
          "Refunded GHST (from diamond to recipient):",
          ethers.utils.formatEther(refundAmount)
        );
        // refund should equal ghstReceived - order price
        expect(refundAmount).to.equal(
          (decodedSwap.ghstReceived as BigNumber).sub(priceInWei)
        );
      }
    }

    const eventTopic = erc721BuyOrderInterface.getEventTopic(
      "ERC721BuyOrderAdded"
    );
    const orderLog = receipt.logs.find(
      (log: any) => log.topics[0] === eventTopic
    );
    expect(orderLog, "ERC721BuyOrderAdded event not found").to.exist;

    const decoded = erc721BuyOrderInterface.decodeEventLog(
      "ERC721BuyOrderAdded",
      orderLog.data,
      orderLog.topics
    );

    // buyOrderId is indexed, it's topics[1]
    const newBuyOrderId = BigNumber.from(orderLog.topics[1]);

    const storedOrder = await erc721BuyOrderFacet.getERC721BuyOrder(
      newBuyOrderId
    );
    expect(storedOrder.buyer).to.equal(deployer.address);
    expect(storedOrder.priceInWei).to.equal(priceInWei);

    const statuses = await erc721BuyOrderFacet.getERC721BuyOrderStatuses([
      newBuyOrderId,
    ]);
    expect(statuses[0].status).to.equal("pending");

    const finalDiamondGhst = await ghstToken.balanceOf(ADDRESSES.DIAMOND);
    // diamond retains GHST equal to order price
    expect(finalDiamondGhst.sub(initialDiamondGhst)).to.equal(priceInWei);

    const finalUsdcBalance = await usdcToken.balanceOf(deployer.address);
    expect(finalUsdcBalance).to.be.lt(initialUsdcBalance);

    // Validate the swap event emitted by BuyOrderSwapFacet
    const swapEventTopic = buyOrderSwapFacet.interface.getEventTopic(
      "SwapAndPlaceERC721BuyOrder"
    );
    const swapLog = receipt.logs.find(
      (log: any) => log.topics[0] === swapEventTopic
    );
    expect(swapLog, "SwapAndPlaceERC721BuyOrder event not found").to.exist;
  }).timeout(120000);
});
