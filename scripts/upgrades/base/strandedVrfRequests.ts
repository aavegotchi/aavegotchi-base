import { type LegacyVrfPreflightSummary } from "./chainlinkVrfPreflight";

export const HARDCODED_BASE_STRANDED_VRF_REQUESTS: LegacyVrfPreflightSummary = {
  latestBlock: 45_022_478,
  pendingPortalCount: 1,
  pendingPortalTokenIds: ["783"],
  pendingForgeCount: 4,
  pendingForge: [
    {
      user: "0xa98e714577ad2b41efbcb5f79c3cd663bc806905",
      requestId: "89869",
    },
    {
      user: "0x9fe6d7d5e9c9e3bff91149fbf731b618cbce3375",
      requestId: "89877",
    },
    {
      user: "0xa9465d03ba38726277b3e478ac98aa063a0c8d0a",
      requestId: "89871",
    },
    {
      user: "0xc4cb6cb969e8b4e309ab98e4da51b77887afad96",
      requestId: "89872",
    },
  ],
  readyToClaimForgeCount: 0,
  readyToClaimForge: [],
};

