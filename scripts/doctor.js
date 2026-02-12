#!/usr/bin/env node
/* eslint-disable no-console */

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, {
    cwd: opts.cwd,
    stdio: "inherit",
    shell: false,
  });

  if (res.error) {
    return { ok: false, code: 1 };
  }

  return { ok: res.status === 0, code: res.status ?? 1 };
}

function header(title) {
  console.log(`\n== ${title} ==`);
}

function main() {
  const repoRoot = path.resolve(__dirname, "..");
  const failures = [];

  header("Aavegotchi Contracts Doctor");

  header("Repo Root");
  console.log(repoRoot);

  header("Node");
  console.log(`node ${process.version}`);

  header("Submodules");
  const forgeStdPath = path.join(repoRoot, "lib", "forge-std");
  if (!fs.existsSync(forgeStdPath)) {
    failures.push("Missing submodule: lib/forge-std");
    console.error("Expected git submodules to be initialized.");
    console.error("Run: git submodule update --init --recursive");
  } else {
    console.log("OK: lib/forge-std present");
  }

  header("Environment");
  const envPath = path.join(repoRoot, ".env");
  if (fs.existsSync(envPath)) {
    require("dotenv").config({ path: envPath });
    console.log("Loaded .env");
  } else {
    console.log("No .env found (this is OK for some workflows).");
  }

  // Many workflows/tests use a local Base mainnet fork (Hardhat hardhat network).
  // BASE_RPC_URL is required for fork-based tests and may also be required by hardhat config.
  const requiredEnv = ["BASE_RPC_URL"];
  const missingEnv = requiredEnv.filter((k) => {
    const v = process.env[k];
    return typeof v !== "string" || v.trim().length === 0;
  });
  if (missingEnv.length > 0) {
    failures.push(`Missing env vars: ${missingEnv.join(", ")}`);
    console.error(`Missing required environment variables: ${missingEnv.join(", ")}`);
    console.error("Create a local .env file (ignored by git) and set these values.");
    console.error("If this repo has a .env.example, start with: cp .env.example .env");
  } else {
    console.log(`OK: required env vars present: ${requiredEnv.join(", ")}`);
  }

  header("Foundry");
  if (!run("forge", ["--version"], { cwd: repoRoot }).ok) {
    failures.push("Foundry not available (forge not found)");
    console.error("Install Foundry: https://book.getfoundry.sh/getting-started/installation");
  } else {
    if (!run("forge", ["build", "--sizes"], { cwd: repoRoot }).ok) {
      failures.push("forge build failed");
    }
  }

  header("Hardhat");
  if (!run("npx", ["hardhat", "compile"], { cwd: repoRoot }).ok) {
    failures.push("hardhat compile failed");
  }

  header("Result");
  if (failures.length > 0) {
    console.error("Doctor found issues:");
    for (const f of failures) console.error(`- ${f}`);
    process.exit(1);
  }

  console.log("OK: environment looks healthy");
}

main();

