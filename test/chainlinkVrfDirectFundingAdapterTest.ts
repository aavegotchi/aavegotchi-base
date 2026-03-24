import { expect } from "chai";
import { ethers } from "hardhat";

describe("ChainlinkVrfDirectFundingAdapter", function () {
  async function deployFixture() {
    const [owner] = await ethers.getSigners();

    const Consumer = await ethers.getContractFactory("MockVRFSystemConsumer");
    const consumer = await Consumer.deploy();
    await consumer.deployed();

    const Wrapper = await ethers.getContractFactory("MockVRFV2PlusWrapper");
    const wrapper = await Wrapper.deploy();
    await wrapper.deployed();

    const Adapter = await ethers.getContractFactory(
      "ChainlinkVrfDirectFundingAdapter"
    );
    const adapter = await Adapter.deploy(wrapper.address, 500000, 3, [
      consumer.address,
    ]);
    await adapter.deployed();

    await owner.sendTransaction({
      to: adapter.address,
      value: ethers.utils.parseEther("1"),
    });

    return { adapter, consumer, wrapper };
  }

  it("routes direct-funded Chainlink fulfillment back to the requesting consumer", async function () {
    const { adapter, consumer, wrapper } = await deployFixture();

    await consumer.requestRandomNumber(adapter.address, 123);
    const requestId = await wrapper.lastRequestId();

    const request = await adapter.getRequestStatus(requestId);
    expect(request.callbackContract).to.equal(consumer.address);
    expect(request.traceId).to.equal(123);
    expect(request.fulfilled).to.equal(false);
    expect(request.delivered).to.equal(false);

    await wrapper.fulfillRequest(requestId, [777]);

    expect(await consumer.lastRequestId()).to.equal(requestId);
    expect(await consumer.lastRandomNumber()).to.equal(777);
    expect(await consumer.totalCallbacks()).to.equal(1);

    const cleared = await adapter.getRequestStatus(requestId);
    expect(cleared.callbackContract).to.equal(ethers.constants.AddressZero);
  });

  it("stores failed downstream deliveries for retry without losing the random word", async function () {
    const { adapter, consumer, wrapper } = await deployFixture();

    await consumer.setShouldFail(true);
    await consumer.requestRandomNumber(adapter.address, 456);
    const requestId = await wrapper.lastRequestId();

    await expect(wrapper.fulfillRequest(requestId, [999])).to.not.be.reverted;

    expect(await consumer.totalCallbacks()).to.equal(0);

    const pending = await adapter.getRequestStatus(requestId);
    expect(pending.callbackContract).to.equal(consumer.address);
    expect(pending.traceId).to.equal(456);
    expect(pending.randomNumber).to.equal(999);
    expect(pending.fulfilled).to.equal(true);
    expect(pending.delivered).to.equal(false);

    await consumer.setShouldFail(false);
    await adapter.retryCallback(requestId);

    expect(await consumer.lastRequestId()).to.equal(requestId);
    expect(await consumer.lastRandomNumber()).to.equal(999);
    expect(await consumer.totalCallbacks()).to.equal(1);

    const cleared = await adapter.getRequestStatus(requestId);
    expect(cleared.callbackContract).to.equal(ethers.constants.AddressZero);
  });

  it("reverts when the adapter does not have enough native balance to pay the wrapper", async function () {
    const Consumer = await ethers.getContractFactory("MockVRFSystemConsumer");
    const consumer = await Consumer.deploy();
    await consumer.deployed();

    const Wrapper = await ethers.getContractFactory("MockVRFV2PlusWrapper");
    const wrapper = await Wrapper.deploy();
    await wrapper.deployed();

    const Adapter = await ethers.getContractFactory(
      "ChainlinkVrfDirectFundingAdapter"
    );
    const adapter = await Adapter.deploy(wrapper.address, 500000, 3, [
      consumer.address,
    ]);
    await adapter.deployed();

    await expect(consumer.requestRandomNumber(adapter.address, 1)).to.be
      .reverted;
  });

  it("rejects requests from contracts that are not approved consumers", async function () {
    const Consumer = await ethers.getContractFactory("MockVRFSystemConsumer");
    const approvedConsumer = await Consumer.deploy();
    await approvedConsumer.deployed();

    const unauthorizedConsumer = await Consumer.deploy();
    await unauthorizedConsumer.deployed();

    const Wrapper = await ethers.getContractFactory("MockVRFV2PlusWrapper");
    const wrapper = await Wrapper.deploy();
    await wrapper.deployed();

    const Adapter = await ethers.getContractFactory(
      "ChainlinkVrfDirectFundingAdapter"
    );
    const adapter = await Adapter.deploy(wrapper.address, 500000, 3, [
      approvedConsumer.address,
    ]);
    await adapter.deployed();

    const [owner] = await ethers.getSigners();
    await owner.sendTransaction({
      to: adapter.address,
      value: ethers.utils.parseEther("1"),
    });

    await expect(
      unauthorizedConsumer.requestRandomNumber(adapter.address, 1)
    ).to.be.revertedWith("ChainlinkVrfAdapter: consumer not approved");
  });
});
