import { expect } from "chai";
import { ethers } from "hardhat";

describe("VRF reroll facets", function () {
  it("rerolls a pending portal onto the active VRF system", async function () {
    const MockVrfSystem = await ethers.getContractFactory("MockVrfSystem");
    const mockVrfSystem = await MockVrfSystem.deploy();
    await mockVrfSystem.deployed();

    const Harness = await ethers.getContractFactory("VrfFacetHarness");
    const harness = await Harness.deploy();
    await harness.deployed();

    await harness.setVRFSystemHarness(mockVrfSystem.address);
    await harness.setPortalPending(783, 55);

    await expect(harness.rerollPendingPortal(783))
      .to.emit(harness, "PortalRerolled")
      .withArgs(783, 1);

    expect(await mockVrfSystem.lastTraceId()).to.equal(783);
    expect(await harness.portalStatus(783)).to.equal(1);
    expect(await harness.tokenIdForRequest(1)).to.equal(783);
  });

  it("reverts when rerolling a portal that is not pending", async function () {
    const MockVrfSystem = await ethers.getContractFactory("MockVrfSystem");
    const mockVrfSystem = await MockVrfSystem.deploy();
    await mockVrfSystem.deployed();

    const Harness = await ethers.getContractFactory("VrfFacetHarness");
    const harness = await Harness.deploy();
    await harness.deployed();

    await harness.setVRFSystemHarness(mockVrfSystem.address);

    await expect(harness.rerollPendingPortal(999)).to.be.revertedWith(
      "VrfFacet: VRF is not pending"
    );
  });

  it("rerolls a pending forge request and preserves the geode payload", async function () {
    const [user] = await ethers.getSigners();

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

    await expect(harness.rerollPendingForgeRequest(88))
      .to.emit(harness, "VrfRequestRerolled")
      .withArgs(user.address, 88, 1);

    expect(await mockVrfSystem.lastTraceId()).to.equal(88);
    expect(await harness.isUserVrfPending(user.address)).to.equal(true);

    const requestIds = await harness.getRequestIds(user.address);
    expect(requestIds.map((id) => id.toNumber())).to.deep.equal([88, 1]);

    const oldRequest = await harness.getRequestInfoByRequestId(88);
    expect(oldRequest.status).to.equal(2);

    const newRequest = await harness.getRequestInfo(user.address);
    expect(newRequest.requestId).to.equal(1);
    expect(newRequest.status).to.equal(0);
    expect(
      newRequest.geodeTokenIds.map((id: any) => id.toNumber())
    ).to.deep.equal([1_000_000_002, 1_000_000_004]);
    expect(
      newRequest.amountPerToken.map((id: any) => id.toNumber())
    ).to.deep.equal([1, 2]);
  });

  it("reverts when rerolling a forge request that is not pending", async function () {
    const Harness = await ethers.getContractFactory("ForgeVRFFacetHarness");
    const harness = await Harness.deploy();
    await harness.deployed();

    await expect(harness.rerollPendingForgeRequest(999)).to.be.revertedWith(
      "ForgeVRFFacet: request not found"
    );
  });
});
