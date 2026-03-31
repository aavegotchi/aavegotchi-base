import { expect } from "chai";
import {
  filterPendingAGIPs,
  parseAGIPSelection,
  parseDeploymentOptions,
} from "../scripts/xp-drop-deploy-utils";

describe("deploy pending XP drops script", function () {
  it("parses AGIP selections with ranges and commas", function () {
    expect(parseAGIPSelection("154-156,158")).to.deep.equal([
      154, 155, 156, 158,
    ]);
  });

  it("parses CLI deployment options for explicit AGIP filters", function () {
    const options = parseDeploymentOptions([
      "node",
      "script",
      "--agips=154-158",
      "--dry-run",
    ]);

    expect(Array.from(options.agipNumbers ?? [])).to.deep.equal([
      154, 155, 156, 157, 158,
    ]);
    expect(options.isDryRun).to.equal(true);
  });

  it("filters only pending AGIPs in the requested set", function () {
    const filtered = filterPendingAGIPs(
      {
        agip_153: {
          agip_number: 153,
          title: "Already deployed",
          status: "deployed",
          sigprop_id: "sig-153",
          coreprop_id: "core-153",
        },
        agip_154: {
          agip_number: 154,
          title: "AGIP 154",
          status: "pending",
          sigprop_id: "sig-154",
          coreprop_id: "core-154",
        },
        agip_155: {
          agip_number: 155,
          title: "AGIP 155",
          status: "pending",
          sigprop_id: "sig-155",
          coreprop_id: "core-155",
        },
        agip_158: {
          agip_number: 158,
          title: "AGIP 158",
          status: "pending",
          sigprop_id: "sig-158",
          coreprop_id: "core-158",
        },
      },
      { agipNumbers: new Set([155, 158]), isDryRun: false }
    );

    expect(filtered.map((entry) => entry.agip_number)).to.deep.equal([
      155, 158,
    ]);
  });
});
