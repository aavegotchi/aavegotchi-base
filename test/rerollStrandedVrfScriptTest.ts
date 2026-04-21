import { expect } from "chai";

import {
  filterAlreadyRerolledRequests,
  type AdapterRequestMarker,
} from "../scripts/upgrades/base/reroll-strandedVrf";
import { type LegacyVrfPreflightSummary } from "../scripts/upgrades/base/chainlinkVrfPreflight";

describe("reroll stranded VRF script", function () {
  const aavegotchiDiamond = "0xA99c4B08201F2913Db8D28e71d020c4298F29dBF";
  const forgeDiamond = "0x50aF2d63b839aA32b4166FD1Cb247129b715186C";

  function baseSummary(): LegacyVrfPreflightSummary {
    return {
      latestBlock: 1,
      pendingPortalCount: 2,
      pendingPortalTokenIds: ["783", "999"],
      pendingForgeCount: 2,
      pendingForge: [
        { user: "0x1", requestId: "89869" },
        { user: "0x2", requestId: "89870" },
      ],
      readyToClaimForgeCount: 0,
      readyToClaimForge: [],
    };
  }

  it("skips legacy requests that already have adapter reroll requests", async function () {
    const adapterRequests: AdapterRequestMarker[] = [
      {
        callbackContract: aavegotchiDiamond,
        requestId: "1001",
        traceId: "783",
        paid: "1",
      },
      {
        callbackContract: forgeDiamond,
        requestId: "1002",
        traceId: "89869",
        paid: "1",
      },
    ];

    const filtered = filterAlreadyRerolledRequests(
      baseSummary(),
      aavegotchiDiamond,
      forgeDiamond,
      adapterRequests
    );

    expect(filtered.pendingPortalTokenIds).to.deep.equal(["999"]);
    expect(filtered.pendingForge).to.deep.equal([
      { user: "0x2", requestId: "89870" },
    ]);
    expect(filtered.pendingPortalCount).to.equal(1);
    expect(filtered.pendingForgeCount).to.equal(1);
  });

  it("skips forge requests that are already pending on the adapter", async function () {
    const summary = baseSummary();
    summary.pendingForge = [{ user: "0x1", requestId: "1002" }];
    summary.pendingForgeCount = 1;

    const adapterRequests: AdapterRequestMarker[] = [
      {
        callbackContract: forgeDiamond,
        requestId: "1002",
        traceId: "89869",
        paid: "1",
      },
    ];

    const filtered = filterAlreadyRerolledRequests(
      summary,
      aavegotchiDiamond,
      forgeDiamond,
      adapterRequests
    );

    expect(filtered.pendingForge).to.deep.equal([]);
    expect(filtered.pendingForgeCount).to.equal(0);
  });

  it("does not treat unrelated adapter requests as rerolls", async function () {
    const adapterRequests: AdapterRequestMarker[] = [
      {
        callbackContract: forgeDiamond,
        requestId: "1002",
        traceId: "0",
        paid: "1",
      },
      {
        callbackContract: "0x0000000000000000000000000000000000000001",
        requestId: "1003",
        traceId: "783",
        paid: "1",
      },
    ];

    const filtered = filterAlreadyRerolledRequests(
      baseSummary(),
      aavegotchiDiamond,
      forgeDiamond,
      adapterRequests
    );

    expect(filtered.pendingPortalTokenIds).to.deep.equal(["783", "999"]);
    expect(filtered.pendingForge).to.deep.equal([
      { user: "0x1", requestId: "89869" },
      { user: "0x2", requestId: "89870" },
    ]);
    expect(filtered.pendingPortalCount).to.equal(2);
    expect(filtered.pendingForgeCount).to.equal(2);
  });
});
