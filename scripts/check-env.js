#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require("fs");
const path = require("path");

function parseArgs(argv) {
  const args = { require: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-h" || a === "--help") args.help = true;
    else if (a === "--require") args.require = argv[++i] || "";
    else if (a.startsWith("--require=")) args.require = a.slice("--require=".length);
  }
  return args;
}

function usage() {
  return `Usage:
  node scripts/check-env.js
  node scripts/check-env.js --require BASE_RPC_URL,MATIC_URL

Defaults:
  Checks BASE_RPC_URL (needed for fork-based Hardhat tests).`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    process.exit(0);
  }

  const repoRoot = path.resolve(__dirname, "..");
  const envPath = path.join(repoRoot, ".env");

  if (fs.existsSync(envPath)) {
    require("dotenv").config({ path: envPath });
  }

  const required =
    args.require && args.require.trim().length > 0
      ? args.require
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : ["BASE_RPC_URL"];

  const missing = required.filter((k) => {
    const v = process.env[k];
    return typeof v !== "string" || v.trim().length === 0;
  });

  if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.join(", ")}`);
    console.error("Create a local .env file (ignored by git) with these values.");

    const envExamplePath = path.join(repoRoot, ".env.example");
    if (fs.existsSync(envExamplePath)) {
      console.error("Tip: cp .env.example .env");
    }

    process.exit(1);
  }

  console.log(`OK: required env vars present: ${required.join(", ")}`);
}

main();

