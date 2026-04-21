import { expect } from "chai";
import { ethers } from "hardhat";

describe("VRF reroll facets", function () {
  it("rerolls pending portals onto the active VRF system in one transaction", async function () {
    const MockVrfSystem = await ethers.getContractFactory("MockVrfSystem");
    const mockVrfSystem = await MockVrfSystem.deploy();
    await mockVrfSystem.deployed();

    const Harness = await ethers.getContractFactory("VrfFacetHarness");
    const harness = await Harness.deploy();
    await harness.deployed();

    await harness.setVRFSystemHarness(mockVrfSystem.address);
    await harness.setPortalPending(783, 55);
    await harness.setPortalPending(784, 56);

    const tx = await harness.rerollPendingPortals([783, 784]);
    const receipt = await tx.wait();
    const openPortalsEvent = receipt.events?.find(
      (event) => event.event === "OpenPortals"
    );
    expect(openPortalsEvent?.args?._tokenIds.map((id: any) => id.toNumber())).to
      .deep.equal([783, 784]);

    expect(await mockVrfSystem.lastTraceId()).to.equal(784);
    expect(await harness.portalStatus(783)).to.equal(1);
    expect(await harness.portalStatus(784)).to.equal(1);
    expect(await harness.tokenIdForRequest(1)).to.equal(783);
    expect(await harness.tokenIdForRequest(2)).to.equal(784);
  });

  it("reverts when rerolling portals and one is not pending", async function () {
    const MockVrfSystem = await ethers.getContractFactory("MockVrfSystem");
    const mockVrfSystem = await MockVrfSystem.deploy();
    await mockVrfSystem.deployed();

    const Harness = await ethers.getContractFactory("VrfFacetHarness");
    const harness = await Harness.deploy();
    await harness.deployed();

    await harness.setVRFSystemHarness(mockVrfSystem.address);

    await expect(harness.rerollPendingPortals([999])).to.be.revertedWith(
      "VrfFacet: VRF is not pending"
    );
  });

  it("rerolls pending forge requests and preserves the geode payloads", async function () {
    const [user, user2] = await ethers.getSigners();

    const MockVrfSystem = await ethers.getContractFactory("MockVrfSystem");
    const mockVrfSystem = await MockVrfSystem.deploy();
    await mockVrfSystem.deployed();

    const Harness = await ethers.getContractFactory("ForgeVRFFacetHarness");
    const harness = await Harness.deploy();
    await harness.deployed();

    await harness.setVRFSystemHarness(mockVrfSystem.address);
    await harness.setPendingRequest(
      user.address,
      88,
      [1_000_000_002, 1_000_000_004],
      [1, 2]
    );
    await harness.setPendingRequest(user2.address, 99, [1_000_000_003], [3]);

    await harness.rerollPendingForgeRequests([88, 99]);

    expect(await mockVrfSystem.lastTraceId()).to.equal(99);
    expect(await harness.isUserVrfPending(user.address)).to.equal(true);
    expect(await harness.isUserVrfPending(user2.address)).to.equal(true);

    const requestIds = await harness.getRequestIds(user.address);
    expect(requestIds.map((id) => id.toNumber())).to.deep.equal([88, 1]);
    const requestIds2 = await harness.getRequestIds(user2.address);
    expect(requestIds2.map((id) => id.toNumber())).to.deep.equal([99, 2]);

    const oldRequest = await harness.getRequestInfoByRequestId(88);
    expect(oldRequest.status).to.equal(2);
    const oldRequest2 = await harness.getRequestInfoByRequestId(99);
    expect(oldRequest2.status).to.equal(2);

    const newRequest = await harness.getRequestInfo(user.address);
    expect(newRequest.requestId).to.equal(1);
    expect(newRequest.status).to.equal(0);
    expect(
      newRequest.geodeTokenIds.map((id: any) => id.toNumber())
    ).to.deep.equal([1_000_000_002, 1_000_000_004]);
    expect(
      newRequest.amountPerToken.map((id: any) => id.toNumber())
    ).to.deep.equal([1, 2]);

    const newRequest2 = await harness.getRequestInfo(user2.address);
    expect(newRequest2.requestId).to.equal(2);
    expect(newRequest2.status).to.equal(0);
    expect(
      newRequest2.geodeTokenIds.map((id: any) => id.toNumber())
    ).to.deep.equal([1_000_000_003]);
    expect(
      newRequest2.amountPerToken.map((id: any) => id.toNumber())
    ).to.deep.equal([3]);
  });

  it("reverts when rerolling forge requests and one is not pending", async function () {
    const Harness = await ethers.getContractFactory("ForgeVRFFacetHarness");
    const harness = await Harness.deploy();
    await harness.deployed();

    await expect(harness.rerollPendingForgeRequests([999])).to.be.revertedWith(
      "ForgeVRFFacet: request not found"
    );
  });
});
