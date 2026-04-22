import { expect } from "chai";
import { ethers } from "hardhat";

import {
  assertNoPendingLegacyVrfRequests,
  getLegacyVrfPreflightSummary,
} from "../scripts/upgrades/base/chainlinkVrfPreflight";

describe("Chainlink VRF preflight", function () {
  it("reports zero pending requests when portals are fulfilled and forge requests are ready to claim", async function () {
    const Portal = await ethers.getContractFactory("MockPortalVrfHistory");
    const portal = await Portal.deploy();
    await portal.deployed();

    const Forge = await ethers.getContractFactory("MockForgeVrfHistory");
    const forge = await Forge.deploy();
    await forge.deployed();

    const [user] = await ethers.getSigners();
    await portal.emitOpenPortals([1, 2]);
    await portal.emitPortalOpened(1);
    await portal.emitPortalOpened(2);

    await forge.emitBatchGeodeOpen(
      user.address,
      [1_000_000_002, 1_000_000_003],
      [1, 1],
      1,
      77
    );

    const summary = await getLegacyVrfPreflightSummary(ethers.provider, {
      aavegotchiDiamond: portal.address,
      forgeDiamond: forge.address,
    });

    expect(summary.pendingPortalCount).to.equal(0);
    expect(summary.pendingForgeCount).to.equal(0);
    expect(summary.readyToClaimForgeCount).to.equal(1);

    await expect(
      assertNoPendingLegacyVrfRequests(ethers.provider, {
        aavegotchiDiamond: portal.address,
        forgeDiamond: forge.address,
      })
    ).to.not.be.reverted;
  });

  it("throws when any legacy portal or forge callback is still pending", async function () {
    const Portal = await ethers.getContractFactory("MockPortalVrfHistory");
    const portal = await Portal.deploy();
    await portal.deployed();

    const Forge = await ethers.getContractFactory("MockForgeVrfHistory");
    const forge = await Forge.deploy();
    await forge.deployed();

    const [user] = await ethers.getSigners();
    await portal.emitOpenPortals([1234]);
    await forge.emitSingleGeodeOpen(user.address, 1_000_000_002, 1, 0, 88);

    await expect(
      assertNoPendingLegacyVrfRequests(ethers.provider, {
        aavegotchiDiamond: portal.address,
        forgeDiamond: forge.address,
      })
    ).to.be.rejectedWith("Legacy PoP VRF requests are still pending");
  });
});
