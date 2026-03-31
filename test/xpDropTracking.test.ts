import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";

interface ExpectedAGIPEntry {
  agip: number;
  title: string;
  sigpropId: string;
  corepropId: string;
}

const expectedEntries: ExpectedAGIPEntry[] = [
  {
    agip: 154,
    title: "DAO Foundation Director Election",
    sigpropId: "0xa0bdb8d05a900580870702f0518e10a7084561b7a1e099a2dea38d1155913c26",
    corepropId: "0xdb7475e47988273620679e539df424f793394682b9191ab578d8f726867659bb",
  },
  {
    agip: 155,
    title: "A Partial Treasury Distribution (PTD)",
    sigpropId: "0x50ae908097ccad954267677e14a9f0814a9415c90173e6d8b1d1647d29d8c553",
    corepropId: "0x7100d11d47d82da653e82eebfde8b5208ffc45f94d8d52e5e1f09b92ab871f09",
  },
  {
    agip: 156,
    title: "Skynet Trading <> Aavegotchi Market Maker SigProp",
    sigpropId: "0x1d954d7c509a48189a8b45fbe73c08839031c43768a0e3f8009b722c856cfe3c",
    corepropId: "0x4166539d9aef080a824e992869ec06763d0db9c7165cc2be20768aca513473a9",
  },
  {
    agip: 157,
    title: "Reducing Wallet Fragmentation for Better DAO Operations",
    sigpropId: "0xc5747de71c3c5313a1b86dc6011b8aa7f2bc3818e2136fe3720b59e4ff0b9dd1",
    corepropId: "0x6b80d6062599ba4e6293e5476015d7c595383721b713972759c276c017a615fd",
  },
  {
    agip: 158,
    title:
      "Clarifying the intended eligibility of the Gotchi Battler portion of AGIP-155",
    sigpropId: "0x7fd90c724350c567d202a94466cc495962b4f092a554e23dcd23fa1e4cb5a704",
    corepropId: "0x389e5bd52432d7a431abeb7d539ddba811250f838b721674f4754aeb1164bc2b",
  },
];

describe("XP drop tracking", function () {
  const repoRoot = path.resolve(__dirname, "..");
  const trackingPath = path.join(repoRoot, "scripts", "xp-drop-tracking.json");
  const tracking = JSON.parse(fs.readFileSync(trackingPath, "utf8"));

  it("tracks AGIP 154-158 with generated sigprop/coreprop scripts", function () {
    for (const entry of expectedEntries) {
      const trackingKey = `agip_${entry.agip}`;
      const trackedEntry = tracking[trackingKey];

      expect(trackedEntry, `Missing ${trackingKey} in xp-drop-tracking.json`).to
        .exist;
      expect(trackedEntry.title).to.equal(entry.title);
      expect(trackedEntry.status).to.equal("pending");
      expect(trackedEntry.sigprop_id).to.equal(entry.sigpropId);
      expect(trackedEntry.coreprop_id).to.equal(entry.corepropId);

      const sigpropScript = `scripts/airdrops/sigprops/merkle/grantXP_agip${entry.agip}.ts`;
      const corepropScript = `scripts/airdrops/coreprops/merkle/grantXP_agip${entry.agip}_coreprop.ts`;

      expect(trackedEntry.sigprop_script).to.equal(sigpropScript);
      expect(trackedEntry.coreprop_script).to.equal(corepropScript);

      const sigpropScriptPath = path.join(repoRoot, sigpropScript);
      const corepropScriptPath = path.join(repoRoot, corepropScript);

      expect(fs.existsSync(sigpropScriptPath), `Missing ${sigpropScript}`).to.be
        .true;
      expect(
        fs.existsSync(corepropScriptPath),
        `Missing ${corepropScript}`
      ).to.be.true;

      expect(fs.readFileSync(sigpropScriptPath, "utf8")).to.include(
        entry.sigpropId
      );
      expect(fs.readFileSync(corepropScriptPath, "utf8")).to.include(
        entry.corepropId
      );
    }
  });
});
