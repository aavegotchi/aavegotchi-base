import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DiamondLoupeFacet } from "../../typechain";
import {
  Interface,
  FormatTypes,
  FunctionFragment,
  EventFragment,
} from "@ethersproject/abi";
import { utils } from "ethers";
import * as fs from "fs";
import * as path from "path";

export interface FacetSelectorInfo {
  selector: string;
  signature?: string;
  stateMutability?: string;
  implementationHash?: string;
  sourceHash?: string;
  astNode?: any;
  functionName?: string;
}

interface SelectorChange {
  selector: string;
  signature: string;
  functionName: string;
}

export interface FacetInternalInfo {
  name: string;
  visibility: string;
  signature?: string;
  contentHash?: string;
  sourceHash?: string;
}

export interface FacetEventInfo {
  signature: string;
}

export interface DiamondFacetSnapshot {
  facetName?: string;
  facetAddress?: string;
  bytecodeHash?: string;
  abiHash?: string;
  buildInfoPath?: string;
  sourceName?: string;
  selectors: FacetSelectorInfo[];
  internalFunctions?: FacetInternalInfo[];
  events?: FacetEventInfo[];
}

export interface DiamondSnapshot {
  diamondAddress: string;
  chainId: string;
  network: string;
  blockNumber: number;
  blockTimestamp: number;
  commit?: string;
  facets: DiamondFacetSnapshot[];
}

export interface DiamondSnapshotHistory {
  diamondAddress: string;
  chainId: string;
  network: string;
  history: DiamondSnapshot[];
}

export interface FacetCatalogEntry {
  contractName: string;
  sourceName: string;
  deployedBytecode: string;
  deployedBytecodeHash: string;
  artifactPath: string;
  dbgPath?: string;
  buildInfoPath?: string;
  abi: any[];
  interface: Interface;
  selectorMap: Record<string, FacetSelectorInfo>;
  selectors: string[];
  selectorsKey: string;
  selectorDetails: Record<
    string,
    {
      signature?: string;
      implementationHash?: string;
      sourceHash?: string;
      functionName?: string;
    }
  >;
  events: FacetEventInfo[];
  internalFunctions: FacetInternalInfo[];
  abiHash: string;
}

export interface FacetCatalog {
  byName: Record<string, FacetCatalogEntry>;
  byBytecodeHash: Record<string, FacetCatalogEntry>;
  bySelectorsKey: Record<string, FacetCatalogEntry>;
}

export interface PlannedFacetInput {
  facetName: string;
  addSelectors: string[];
  removeSelectors: string[];
}

export interface PlannedDiamondState {
  snapshot: DiamondSnapshot;
  removals: string[];
}

export interface SelectorMovement {
  selector: string;
  signature?: string;
  fromFacet?: string;
  toFacet?: string;
}

export interface FacetDiff {
  facetName?: string;
  bytecodeChanged: boolean;
  abiChanged: boolean;
  previousSelectorCount?: number;
  plannedSelectorCount?: number;
  selectorsAdded: string[];
  selectorsAddedNames: string[];
  selectorsAddedDetail: SelectorChange[];
  selectorsRemoved: string[];
  selectorsRemovedNames: string[];
  selectorsRemovedDetail: SelectorChange[];
  selectorsModifiedDirect: string[];
  selectorsModifiedDirectNames: string[];
  selectorsModifiedIndirect: string[];
  selectorsModifiedIndirectNames: string[];
  selectorsAddedHex: string[];
  selectorsRemovedHex: string[];
  selectorsModifiedDirectHex: string[];
  selectorsModifiedIndirectHex: string[];
  internalAdded: string[];
  internalRemoved: string[];
  internalModified: string[];
  eventsAdded: string[];
  eventsRemoved: string[];
}

export interface DiamondDiffReport {
  diamondAddress: string;
  chainId: string;
  referenceTimestamp?: number;
  blockNumber: number;
  generatedAt: number;
  hasReferenceMismatch: boolean;
  referenceCommit?: string;
  plannedCommit?: string;
  facets: FacetDiff[];
  selectorMoves: SelectorMovement[];
  removals: SelectorMovement[];
  referenceMissing: boolean;
  summary: string[];
}

export interface FacetReferenceDiff {
  facetName: string;
  selectorsAddedNames: string[];
  selectorsRemovedNames: string[];
  selectorsModifiedDirectNames: string[];
  selectorsModifiedIndirectNames: string[];
  internalAdded: string[];
  internalRemoved: string[];
  internalModified: string[];
  eventsAdded: string[];
  eventsRemoved: string[];
  abiChanged: boolean;
  bytecodeChanged: boolean;
}

function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function computeAbiHash(abi: any[]): string {
  const normalized = JSON.stringify(abi, Object.keys(abi).sort());
  return utils.keccak256(utils.toUtf8Bytes(normalized));
}

function computeSelectorsKey(selectors: string[]): string {
  return selectors.slice().sort().join(",");
}

function normalisePathSegments(base: string, relative: string) {
  return path.resolve(base, relative);
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 120) || "facet";
}

async function getSnapshotPaths(
  hre: HardhatRuntimeEnvironment,
  diamondAddress: string
) {
  const chainId = await resolveChainId(hre);
  const baseDir = path.join(
    "state",
    "diamond",
    chainId.toString().toLowerCase()
  );
  const snapshotDir = path.join(
    baseDir,
    "snapshots",
    diamondAddress.toLowerCase()
  );
  return {
    snapshotDir,
    currentPath: path.join(snapshotDir, "current_diamond_state.json"),
    legacyPath: path.join(baseDir, `${diamondAddress.toLowerCase()}.json`),
  };
}

export async function resolveChainId(
  hre: HardhatRuntimeEnvironment
): Promise<string> {
  const forkOverride = Number(
    process.env.FORK_CHAIN_ID ??
      process.env.BASE_CHAIN_ID ??
      process.env.DEFAULT_FORK_CHAIN_ID ??
      "8453"
  );
  const isLocalFork = ["hardhat", "localhost"].includes(
    hre.network?.name ?? ""
  );

  const configured = hre.network?.config?.chainId;
  if (configured) {
    if (configured === 31337 && isLocalFork) {
      return forkOverride.toString();
    }
    return configured.toString();
  }

  const networkInfo = await hre.ethers.provider.getNetwork();
  if (networkInfo.chainId === 31337 && isLocalFork) {
    return forkOverride.toString();
  }
  return networkInfo.chainId.toString();
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  const buffer = await fs.promises.readFile(filePath, "utf8");
  return JSON.parse(buffer) as T;
}

interface BuildInfoWithPath {
  info: any;
  path: string;
}

interface CachedBuildInfo extends BuildInfoWithPath {
  mtimeMs: number;
}

const buildInfoCache: Map<string, CachedBuildInfo> = new Map();

async function loadBuildInfo(
  dbgPath?: string
): Promise<BuildInfoWithPath | undefined> {
  if (!dbgPath) return undefined;
  const cached = buildInfoCache.get(dbgPath);
  const dbg = await readJsonFile<{ buildInfo: string }>(dbgPath);
  const buildInfoPath = normalisePathSegments(path.dirname(dbgPath), dbg.buildInfo);
  if (!fs.existsSync(buildInfoPath)) {
    return undefined;
  }
  const stat = await fs.promises.stat(buildInfoPath);
  if (cached && cached.mtimeMs === stat.mtimeMs) {
    return { info: cached.info, path: cached.path };
  }
  const buildInfo = await readJsonFile<any>(buildInfoPath);
  const entry: CachedBuildInfo = { info: buildInfo, path: buildInfoPath, mtimeMs: stat.mtimeMs };
  buildInfoCache.set(dbgPath, entry);
  return { info: entry.info, path: entry.path };
}

function getInternalFunctionsFromBuildInfo(
  buildInfo: any,
  sourceName: string,
  contractName: string
): FacetInternalInfo[] {
  if (!buildInfo) return [];
  const source = buildInfo.output?.sources?.[sourceName];
  if (!source?.ast?.nodes) return [];

  const contractNode = source.ast.nodes.find(
    (node: any) =>
      node.nodeType === "ContractDefinition" && node.name === contractName
  );
  if (!contractNode?.nodes) return [];

  const inputSource = buildInfo.input?.sources?.[sourceName]?.content ?? "";

  const internalFns: FacetInternalInfo[] = [];
  for (const child of contractNode.nodes) {
    if (
      child.nodeType === "FunctionDefinition" &&
      (child.visibility === "internal" || child.visibility === "private")
    ) {
      let sourceHash: string | undefined;
      if (child.src && inputSource) {
        const [startStr, lengthStr] = child.src.split(":");
        const start = Number(startStr);
        const length = Number(lengthStr);
        if (!Number.isNaN(start) && !Number.isNaN(length)) {
          const snippet = inputSource.slice(start, start + length);
          sourceHash = utils.keccak256(utils.toUtf8Bytes(snippet));
        }
      }
      internalFns.push({
        name: child.name || "",
        visibility: child.visibility,
        signature: formatInternalSignature(child),
        contentHash: hashAstNode(child),
        sourceHash,
      });
    }
  }
  return internalFns;
}

function getExternalFunctionDetails(
  buildInfo: any,
  sourceName: string,
  contractName: string,
  iface: Interface
): Record<string, { signature?: string; implementationHash?: string; sourceHash?: string; functionName?: string }> {
  const details: Record<string, { signature?: string; implementationHash?: string; sourceHash?: string; functionName?: string }> = {};
  if (!buildInfo) return details;

  const source = buildInfo.output?.sources?.[sourceName];
  if (!source?.ast?.nodes) return details;

  const inputSource = buildInfo.input?.sources?.[sourceName]?.content ?? "";

  const contractNode = source.ast.nodes.find(
    (node: any) =>
      node.nodeType === "ContractDefinition" && node.name === contractName
  );
  if (!contractNode?.nodes) return details;

  for (const child of contractNode.nodes) {
    if (child.nodeType !== "FunctionDefinition") continue;
    if (child.visibility !== "public" && child.visibility !== "external") {
      continue;
    }

    const name = child.name || "";
    const params =
      child.parameters?.parameters?.map((param: any) =>
        param.typeDescriptions?.typeString ||
        param.typeName?.typeDescriptions?.typeString ||
        param.typeName?.name ||
        "unknown"
      ) ?? [];
    const canonical = `${name}(${params.join(",")})`;
    let selector: string;
    try {
      selector = iface.getSighash(canonical);
    } catch (err) {
      continue;
    }

    let sourceHash: string | undefined;
    if (child.src && inputSource) {
      const [startStr, lengthStr] = child.src.split(":");
      const start = Number(startStr);
      const length = Number(lengthStr);
      if (!Number.isNaN(start) && !Number.isNaN(length)) {
        const snippet = inputSource.slice(start, start + length);
        sourceHash = utils.keccak256(utils.toUtf8Bytes(snippet));
      }
    }

    details[selector] = {
      signature: canonical,
      implementationHash: hashAstNode(child),
      sourceHash,
      functionName: name || canonical.split("(")[0] || selector,
    };
  }

  return details;
}

function parseSelectors(iface: Interface): Record<string, FacetSelectorInfo> {
  const selectors: Record<string, FacetSelectorInfo> = {};
  for (const fragment of Object.values(iface.functions)) {
    const selector = iface.getSighash(fragment as FunctionFragment);
    selectors[selector] = {
      selector,
      signature: (fragment as FunctionFragment).format(FormatTypes.full),
      stateMutability: (fragment as FunctionFragment).stateMutability,
    };
  }
  return selectors;
}

function parseEvents(iface: Interface): FacetEventInfo[] {
  const events: FacetEventInfo[] = [];
  for (const fragment of Object.values(iface.events)) {
    const signature = (fragment as EventFragment).format(FormatTypes.full);
    events.push({ signature });
  }
  return events;
}

async function walkArtifactsDir(dir: string): Promise<string[]> {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const resolved = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkArtifactsDir(resolved)));
    } else if (
      entry.isFile() &&
      entry.name.endsWith(".json") &&
      !entry.name.endsWith(".dbg.json")
    ) {
      files.push(resolved);
    }
  }
  return files;
}

export async function loadFacetCatalog(
  hre: HardhatRuntimeEnvironment
): Promise<FacetCatalog> {
  const artifactsPath = hre.config.paths.artifacts;
  const contractsPath = path.join(artifactsPath, "contracts");
  const artifactFiles = await walkArtifactsDir(contractsPath);

  const byName: Record<string, FacetCatalogEntry> = {};
  const byBytecodeHash: Record<string, FacetCatalogEntry> = {};
  const bySelectorsKey: Record<string, FacetCatalogEntry> = {};

  for (const artifactPath of artifactFiles) {
    const artifact = await readJsonFile<{
      contractName: string;
      sourceName: string;
      deployedBytecode: string;
      abi: any[];
    }>(artifactPath);

    if (!artifact.deployedBytecode || artifact.deployedBytecode === "0x") {
      continue;
    }

    let iface: Interface;
    try {
      iface = new Interface(artifact.abi);
    } catch (err) {
      continue;
    }

    const selectorMap = parseSelectors(iface);
    const events = parseEvents(iface);
    const abiHash = computeAbiHash(artifact.abi);
    const selectorsArray = Object.keys(selectorMap).sort((a, b) =>
      a.localeCompare(b)
    );
    const selectorsKey = computeSelectorsKey(selectorsArray);

    const dbgPathCandidate = artifactPath.replace(/\.json$/, ".dbg.json");
    const dbgPath = fs.existsSync(dbgPathCandidate) ? dbgPathCandidate : undefined;
    const buildInfoWithPath = await loadBuildInfo(dbgPath);
    const internalFunctions = getInternalFunctionsFromBuildInfo(
      buildInfoWithPath?.info,
      artifact.sourceName,
      artifact.contractName
    );
    const selectorDetails = getExternalFunctionDetails(
      buildInfoWithPath?.info,
      artifact.sourceName,
      artifact.contractName,
      iface
    );
    const buildInfoPath = buildInfoWithPath
      ? path.relative(process.cwd(), buildInfoWithPath.path)
      : undefined;

    const entry: FacetCatalogEntry = {
      contractName: artifact.contractName,
      sourceName: artifact.sourceName,
      deployedBytecode: artifact.deployedBytecode,
      deployedBytecodeHash: utils.keccak256(artifact.deployedBytecode),
      artifactPath,
      dbgPath,
      buildInfoPath,
      abi: artifact.abi,
      interface: iface,
      selectorMap,
      selectors: selectorsArray,
      selectorsKey,
      selectorDetails,
      events,
      internalFunctions,
      abiHash,
    };

    byName[entry.contractName] = entry;
    byBytecodeHash[entry.deployedBytecodeHash] = entry;
    if (!bySelectorsKey[selectorsKey]) {
      bySelectorsKey[selectorsKey] = entry;
    }
  }

  return { byName, byBytecodeHash, bySelectorsKey };
}

async function resolveFacetEntryByBytecode(
  catalog: FacetCatalog,
  hre: HardhatRuntimeEnvironment,
  facetAddress: string
): Promise<FacetCatalogEntry | undefined> {
  const code = await hre.ethers.provider.getCode(facetAddress);
  if (!code || code === "0x") return undefined;
  const hash = utils.keccak256(code);
  return catalog.byBytecodeHash[hash];
}

function extractSelectorsFromEntry(entry: FacetCatalogEntry): FacetSelectorInfo[] {
  return entry.selectors.map((selector) => {
    const base = entry.selectorMap[selector];
    const detail = entry.selectorDetails[selector];
    return {
      selector,
      signature: detail?.signature ?? base?.signature,
      stateMutability: base?.stateMutability,
      implementationHash: detail?.implementationHash,
      sourceHash: detail?.sourceHash,
      functionName:
        detail?.functionName ?? base?.signature?.split("(")[0] ?? selector,
    };
  });
}

function extractInternalFromEntry(entry: FacetCatalogEntry): FacetInternalInfo[] {
  return entry.internalFunctions.slice().sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}

function extractEventsFromEntry(entry: FacetCatalogEntry): FacetEventInfo[] {
  return entry.events.slice().sort((a, b) =>
    a.signature.localeCompare(b.signature)
  );
}

export async function captureDiamondSnapshot(
  hre: HardhatRuntimeEnvironment,
  diamondAddress: string,
  catalog: FacetCatalog
): Promise<DiamondSnapshot> {
  const loupe = (await hre.ethers.getContractAt(
    "DiamondLoupeFacet",
    diamondAddress
  )) as DiamondLoupeFacet;

  const chainId = await resolveChainId(hre);
  const network = hre.network.name;
  const block = await hre.ethers.provider.getBlock("latest");

  const facetsRaw = await loupe.facets();

  const facets: DiamondFacetSnapshot[] = await Promise.all(
    facetsRaw.map(async (facet) => {
      let entry = await resolveFacetEntryByBytecode(
        catalog,
        hre,
        facet.facetAddress
      );
      if (!entry) {
        const selectorKey = computeSelectorsKey(
          facet.functionSelectors.map((selector) => selector)
        );
        entry = catalog.bySelectorsKey[selectorKey];
      }

      const runtimeCode = await hre.ethers.provider.getCode(facet.facetAddress);
      const runtimeHash =
        runtimeCode && runtimeCode !== "0x"
          ? utils.keccak256(runtimeCode)
          : undefined;

      const selectors: FacetSelectorInfo[] = facet.functionSelectors.map(
        (selector) => {
          const base = entry?.selectorMap[selector];
          const detail = entry?.selectorDetails[selector];
          return {
            selector,
            signature: detail?.signature ?? base?.signature,
            stateMutability: base?.stateMutability,
            implementationHash: detail?.implementationHash,
            sourceHash: detail?.sourceHash,
            functionName:
              detail?.functionName ?? base?.signature?.split("(")[0] ?? selector,
          };
        }
      );

      return {
        facetName: entry?.contractName,
        facetAddress: facet.facetAddress,
        bytecodeHash: runtimeHash ?? entry?.deployedBytecodeHash,
        abiHash: entry?.abiHash,
        buildInfoPath: entry?.buildInfoPath,
        sourceName: entry?.sourceName,
        selectors,
        internalFunctions: entry ? extractInternalFromEntry(entry) : undefined,
        events: entry ? extractEventsFromEntry(entry) : undefined,
      };
    })
  );

  return {
    diamondAddress,
    chainId,
    network,
    blockNumber: block.number,
    blockTimestamp: block.timestamp,
    facets,
  };
}

export async function buildPlannedSnapshot(
  hre: HardhatRuntimeEnvironment,
  diamondAddress: string,
  facets: PlannedFacetInput[],
  catalog: FacetCatalog,
  _currentSnapshot?: DiamondSnapshot
): Promise<PlannedDiamondState> {
  const chainId = await resolveChainId(hre);
  const network = hre.network.name;
  const block = await hre.ethers.provider.getBlock("latest");

  const diamondFacets: DiamondFacetSnapshot[] = [];
  const removals: string[] = [];

  for (const input of facets) {
    const entry = catalog.byName[input.facetName];
    if (!entry) {
      diamondFacets.push({
        facetName: input.facetName,
        selectors: [],
      });
      removals.push(...input.removeSelectors);
      continue;
    }

    diamondFacets.push({
      facetName: entry.contractName,
      bytecodeHash: entry.deployedBytecodeHash,
      abiHash: entry.abiHash,
      buildInfoPath: entry.buildInfoPath,
      sourceName: entry.sourceName,
      selectors: extractSelectorsFromEntry(entry),
      internalFunctions: extractInternalFromEntry(entry),
      events: extractEventsFromEntry(entry),
    });

    removals.push(...input.removeSelectors);
  }

  return {
    snapshot: {
      diamondAddress,
      chainId,
      network,
      blockNumber: block.number,
      blockTimestamp: block.timestamp,
      facets: diamondFacets,
    },
    removals,
  };
}

export async function readSnapshotHistory(
  hre: HardhatRuntimeEnvironment,
  diamondAddress: string
): Promise<DiamondSnapshotHistory | null> {
  const paths = await getSnapshotPaths(hre, diamondAddress);
  if (fs.existsSync(paths.legacyPath)) {
    return readJsonFile<DiamondSnapshotHistory>(paths.legacyPath);
  }

  if (fs.existsSync(paths.currentPath)) {
    const snapshot = await readJsonFile<DiamondSnapshot>(paths.currentPath);
    return {
      diamondAddress: snapshot.diamondAddress,
      chainId: snapshot.chainId,
      network: snapshot.network,
      history: [snapshot],
    };
  }

  return null;
}

export async function writeSnapshotHistory(
  hre: HardhatRuntimeEnvironment,
  snapshot: DiamondSnapshot
): Promise<void> {
  const paths = await getSnapshotPaths(hre, snapshot.diamondAddress);
  ensureDir(paths.snapshotDir);

  await fs.promises.writeFile(
    paths.currentPath,
    JSON.stringify(snapshot, null, 2),
    "utf8"
  );

  // clean up legacy history/current files if they exist
  if (fs.existsSync(paths.legacyPath)) {
    fs.promises.unlink(paths.legacyPath).catch(() => undefined);
  }
}

function mapSelectorsToFacet(
  snapshot: DiamondSnapshot
): Record<string, DiamondFacetSnapshot> {
  const map: Record<string, DiamondFacetSnapshot> = {};
  for (const facet of snapshot.facets) {
    for (const selector of facet.selectors) {
      map[selector.selector] = facet;
    }
  }
  return map;
}

function uniqueStrings(strings: string[]): string[] {
  const set = new Set(strings);
  return Array.from(set.values());
}

function formatSelector(selector: FacetSelectorInfo) {
  return selector.signature ?? selector.selector;
}

function deriveFunctionName(
  candidate?: string,
  signature?: string,
  selector?: string
): string {
  if (candidate && candidate.trim().length) {
    return candidate.trim();
  }
  if (signature) {
    const trimmed = signature.trim().replace(/^function\s+/i, "");
    const namePart = trimmed.split("(")[0]?.trim();
    if (namePart) {
      const pieces = namePart.split(/\s+/);
      const last = pieces[pieces.length - 1];
      if (last?.length) {
        return last;
      }
    }
  }
  if (selector && selector.trim().length) {
    return selector.trim();
  }
  return "unknown";
}

const OMIT_AST_KEYS = new Set([
  "id",
  "src",
  "referencedDeclaration",
  "absolutePath",
  "scope",
]);

function sanitizeAstNode(node: any): any {
  if (Array.isArray(node)) {
    return node.map((value) => sanitizeAstNode(value));
  }
  if (node && typeof node === "object") {
    const result: Record<string, any> = {};
    Object.keys(node)
      .filter((key) => !OMIT_AST_KEYS.has(key))
      .sort()
      .forEach((key) => {
        result[key] = sanitizeAstNode(node[key]);
      });
    return result;
  }
  return node;
}

function hashAstNode(node: any): string | undefined {
  if (!node) return undefined;
  try {
    const sanitized = sanitizeAstNode(node);
    const json = JSON.stringify(sanitized);
    return utils.keccak256(utils.toUtf8Bytes(json));
  } catch (err) {
    return undefined;
  }
}

function formatInternalSignature(node: any): string | undefined {
  if (!node) return undefined;
  const name = node.name || "";
  const params =
    node.parameters?.parameters?.map((param: any) => {
      const typeString =
        param.typeDescriptions?.typeString ||
        param.typeName?.typeDescriptions?.typeString ||
        param.typeName?.name ||
        "unknown";
      const storage =
        param.storageLocation && param.storageLocation !== "default"
          ? ` ${param.storageLocation}`
          : "";
      const identifier = param.name ? ` ${param.name}` : "";
      return `${typeString}${storage}${identifier}`.trim();
    }) ?? [];

  const returnParams =
    node.returnParameters?.parameters?.map((param: any) => {
      const typeString =
        param.typeDescriptions?.typeString ||
        param.typeName?.typeDescriptions?.typeString ||
        param.typeName?.name ||
        "unknown";
      const identifier = param.name ? ` ${param.name}` : "";
      return `${typeString}${identifier}`.trim();
    }) ?? [];

  const visibility = node.visibility ? `${node.visibility} ` : "";
  const stateMutability =
    node.stateMutability && node.stateMutability !== "nonpayable"
      ? ` ${node.stateMutability}`
      : "";

  let signature = `${visibility}function ${name}(${params.join(", ")})${stateMutability}`.trim();
  if (returnParams.length) {
    signature = `${signature} returns (${returnParams.join(", ")})`;
  }
  return signature;
}

function formatList(values: string[], limit = 3): string {
  if (values.length === 0) return "";
  if (values.length <= limit) {
    return values.join(", ");
  }

  const headCount = Math.max(1, limit - 1);
  const head = values.slice(0, headCount);
  const tail = values[values.length - 1];
  const omitted = values.length - headCount - 1;
  return `${head.join(", ")}, …${omitted > 0 ? ` (+${omitted})` : ""}, ${tail}`;
}

function selectorDiff(
  previous: FacetSelectorInfo[] | undefined,
  planned: FacetSelectorInfo[] | undefined
) {
  const prevMap = new Map<string, FacetSelectorInfo>();
  const plannedMap = new Map<string, FacetSelectorInfo>();

  previous?.forEach((selector) => prevMap.set(selector.selector, selector));
  planned?.forEach((selector) => plannedMap.set(selector.selector, selector));

  const removed: FacetSelectorInfo[] = [];
  const added: FacetSelectorInfo[] = [];
  const shared: Array<{
    selector: string;
    previous: FacetSelectorInfo | undefined;
    planned: FacetSelectorInfo | undefined;
  }> = [];

  for (const [key, value] of prevMap) {
    const plannedValue = plannedMap.get(key);
    if (plannedValue) {
      shared.push({ selector: key, previous: value, planned: plannedValue });
    } else {
      removed.push(value);
    }
  }

  for (const [key, value] of plannedMap) {
    if (!prevMap.has(key)) {
      added.push(value);
    }
  }

  return { added, removed, shared };
}

function diffInternalFunctions(
  previous?: FacetInternalInfo[],
  planned?: FacetInternalInfo[]
) {
  const prevSet = new Map<string, FacetInternalInfo>();
  const plannedSet = new Map<string, FacetInternalInfo>();

  previous?.forEach((fn) => prevSet.set(`${fn.visibility}:${fn.name}`, fn));
  planned?.forEach((fn) => plannedSet.set(`${fn.visibility}:${fn.name}`, fn));

  const removed: string[] = [];
  const added: string[] = [];
  const modified: string[] = [];

  for (const [key, value] of prevSet) {
    if (!plannedSet.has(key)) {
      removed.push(`${value.visibility} ${value.name}`);
    }
  }

  for (const [key, value] of plannedSet) {
    const previousValue = prevSet.get(key);
    if (!previousValue) {
      added.push(`${value.visibility} ${value.name}`);
    } else {
      const contentChanged =
        previousValue.contentHash &&
        value.contentHash &&
        previousValue.contentHash !== value.contentHash;
      const sourceChanged =
        previousValue.sourceHash &&
        value.sourceHash &&
        previousValue.sourceHash !== value.sourceHash;
      const sameSource =
        previousValue.sourceHash &&
        value.sourceHash &&
        previousValue.sourceHash === value.sourceHash;
      if ((contentChanged || sourceChanged) && !sameSource) {
        modified.push(`${value.visibility} ${value.name}`);
      }
    }
  }

  return { added, removed, modified };
}

function diffEvents(
  previous?: FacetEventInfo[],
  planned?: FacetEventInfo[]
) {
  const prevSet = new Set(previous?.map((ev) => ev.signature));
  const plannedSet = new Set(planned?.map((ev) => ev.signature));

  const removed: string[] = [];
  const added: string[] = [];

  previous?.forEach((ev) => {
    if (!plannedSet.has(ev.signature)) {
      removed.push(ev.signature);
    }
  });

  planned?.forEach((ev) => {
    if (!prevSet.has(ev.signature)) {
      added.push(ev.signature);
    }
  });

  return { added, removed };
}

export function diffFacetAgainstReference(
  referenceFacet: DiamondFacetSnapshot,
  entry: FacetCatalogEntry
): FacetReferenceDiff | null {
  const plannedSelectors = extractSelectorsFromEntry(entry);
  const selectorChanges = selectorDiff(referenceFacet?.selectors, plannedSelectors);
  const internalChanges = diffInternalFunctions(
    referenceFacet?.internalFunctions,
    extractInternalFromEntry(entry)
  );
  const hasInternalDelta =
    internalChanges.added.length > 0 ||
    internalChanges.removed.length > 0 ||
    internalChanges.modified.length > 0;
  const eventChanges = diffEvents(
    referenceFacet?.events,
    extractEventsFromEntry(entry)
  );

  const selectorsAddedNames = selectorChanges.added.map((selector) =>
    deriveFunctionName(selector.functionName, selector.signature, selector.selector)
  );
  const selectorsRemovedNames = selectorChanges.removed.map((selector) =>
    deriveFunctionName(selector.functionName, selector.signature, selector.selector)
  );
  const selectorsModifiedDirectNames: string[] = [];
  const selectorsModifiedIndirectNames: string[] = [];

  for (const { previous, planned } of selectorChanges.shared) {
    if (!previous || !planned) continue;
    const functionName = deriveFunctionName(
      planned.functionName,
      planned.signature,
      planned.selector
    );
    const sourceChanged =
      !!previous.sourceHash &&
      !!planned.sourceHash &&
      previous.sourceHash !== planned.sourceHash;
    const implChanged =
      !!previous.implementationHash &&
      !!planned.implementationHash &&
      previous.implementationHash !== planned.implementationHash;

    if (sourceChanged) {
      selectorsModifiedDirectNames.push(functionName);
    } else if (implChanged) {
      if (!previous.sourceHash || !planned.sourceHash) {
        selectorsModifiedDirectNames.push(functionName);
      } else if (hasInternalDelta) {
        selectorsModifiedIndirectNames.push(functionName);
      }
    }
  }

  const bytecodeChanged =
    !!referenceFacet.bytecodeHash &&
    !!entry.deployedBytecodeHash &&
    referenceFacet.bytecodeHash !== entry.deployedBytecodeHash;
  const abiChanged =
    !!referenceFacet.abiHash &&
    !!entry.abiHash &&
    referenceFacet.abiHash !== entry.abiHash;

  const hasChanges =
    selectorsAddedNames.length > 0 ||
    selectorsRemovedNames.length > 0 ||
    selectorsModifiedDirectNames.length > 0 ||
    selectorsModifiedIndirectNames.length > 0 ||
    internalChanges.added.length > 0 ||
    internalChanges.removed.length > 0 ||
    internalChanges.modified.length > 0 ||
    eventChanges.added.length > 0 ||
    eventChanges.removed.length > 0 ||
    abiChanged ||
    bytecodeChanged;

  if (!hasChanges) {
    return null;
  }

  return {
    facetName: referenceFacet.facetName ?? entry.contractName,
    selectorsAddedNames,
    selectorsRemovedNames,
    selectorsModifiedDirectNames,
    selectorsModifiedIndirectNames,
    internalAdded: internalChanges.added,
    internalRemoved: internalChanges.removed,
    internalModified: internalChanges.modified,
    eventsAdded: eventChanges.added,
    eventsRemoved: eventChanges.removed,
    abiChanged,
    bytecodeChanged,
  };
}

export function generateDiamondDiffReport(
  reference: DiamondSnapshot | null,
  plannedState: PlannedDiamondState,
  onChain: DiamondSnapshot | null
): DiamondDiffReport {
  const planned = plannedState.snapshot;
  const removals = uniqueStrings(plannedState.removals);
  const selectorToReferenceFacet = reference
    ? mapSelectorsToFacet(reference)
    : {};
  const selectorToPlannedFacet = mapSelectorsToFacet(planned);

  const facets: FacetDiff[] = [];
  const selectorMoves: SelectorMovement[] = [];
  const removalEntries: SelectorMovement[] = [];

  const referenceFacetsByName: Record<string, DiamondFacetSnapshot> = {};
  const referenceFacetsByAddress: Record<string, DiamondFacetSnapshot> = {};
  reference?.facets.forEach((facet) => {
    if (facet.facetName) referenceFacetsByName[facet.facetName] = facet;
    if (facet.facetAddress)
      referenceFacetsByAddress[facet.facetAddress.toLowerCase()] = facet;
  });

  function resolvePreviousFacet(
    plannedFacet: DiamondFacetSnapshot
  ): DiamondFacetSnapshot | undefined {
    if (!reference) return undefined;

    if (plannedFacet.facetName) {
      const byName = referenceFacetsByName[plannedFacet.facetName];
      if (byName) return byName;
    }

    if (plannedFacet.facetAddress) {
      const byAddress =
        referenceFacetsByAddress[plannedFacet.facetAddress.toLowerCase()];
      if (byAddress) return byAddress;
    }

    const counts = new Map<string, { facet: DiamondFacetSnapshot; count: number }>();
    for (const selector of plannedFacet.selectors || []) {
      const previous = selectorToReferenceFacet[selector.selector];
      if (!previous) continue;
      const key =
        previous.facetAddress?.toLowerCase() ??
        previous.facetName ??
        selector.selector;
      const current = counts.get(key);
      if (current) {
        current.count += 1;
      } else {
        counts.set(key, { facet: previous, count: 1 });
      }
    }
    let best: { facet: DiamondFacetSnapshot; count: number } | undefined;
    for (const candidate of counts.values()) {
      if (!best || candidate.count > best.count) {
        best = candidate;
      }
    }
    return best?.facet;
  }

  for (const plannedFacet of planned.facets) {
    const previousFacet = resolvePreviousFacet(plannedFacet);
    const selectorChanges = selectorDiff(
      previousFacet?.selectors,
      plannedFacet?.selectors
    );
    const internalChanges = diffInternalFunctions(
      previousFacet?.internalFunctions,
      plannedFacet?.internalFunctions
    );
    const hasInternalDelta =
      internalChanges.added.length > 0 ||
      internalChanges.removed.length > 0 ||
      internalChanges.modified.length > 0;
    const eventChanges = diffEvents(
      previousFacet?.events,
      plannedFacet?.events
    );

    let prevBytecode = previousFacet?.bytecodeHash;
    const nextBytecode = plannedFacet.bytecodeHash;
    let bytecodeChanged =
      previousFacet && prevBytecode && nextBytecode
        ? prevBytecode !== nextBytecode
        : false;

    const prevAbi = previousFacet?.abiHash;
    const nextAbi = plannedFacet.abiHash;
    let abiChanged =
      previousFacet && prevAbi && nextAbi ? prevAbi !== nextAbi : false;

    if (!previousFacet) {
      // No baseline to compare against yet; skip change reporting.
      continue;
    }

    const selectorsAddedDetail: SelectorChange[] = selectorChanges.added.map(
      ({ selector, signature, functionName }) => ({
        selector,
        signature: signature ?? selector,
        functionName: deriveFunctionName(functionName, signature, selector),
      })
    );
    const selectorsRemovedDetail: SelectorChange[] = selectorChanges.removed.map(
      ({ selector, signature, functionName }) => ({
        selector,
        signature: signature ?? selector,
        functionName: deriveFunctionName(functionName, signature, selector),
      })
    );
    const selectorsAddedNames = selectorsAddedDetail.map(
      (item) => item.functionName
    );
    const selectorsAdded = selectorsAddedDetail.map((item) => item.signature);
    const selectorsRemovedNames = selectorsRemovedDetail.map(
      (item) => item.functionName
    );
    const selectorsRemoved = selectorsRemovedDetail.map(
      (item) => item.signature
    );
    const selectorsModifiedDirect: string[] = [];
    const selectorsModifiedIndirect: string[] = [];
    const selectorsModifiedDirectHex: string[] = [];
    const selectorsModifiedIndirectHex: string[] = [];
    const selectorsModifiedDirectNames: string[] = [];
    const selectorsModifiedIndirectNames: string[] = [];

    for (const { previous, planned } of selectorChanges.shared) {
      if (!previous || !planned) continue;
      const formatted = formatSelector(planned);
      const functionName = deriveFunctionName(
        planned.functionName,
        planned.signature,
        planned.selector
      );
      const sourceChanged =
        !!previous.sourceHash &&
        !!planned.sourceHash &&
        previous.sourceHash !== planned.sourceHash;
      const implChanged =
        !!previous.implementationHash &&
        !!planned.implementationHash &&
        previous.implementationHash !== planned.implementationHash;

      if (sourceChanged) {
        selectorsModifiedDirect.push(formatted);
        selectorsModifiedDirectHex.push(planned.selector);
        selectorsModifiedDirectNames.push(functionName);
      } else if (implChanged && hasInternalDelta) {
        if (!previous.sourceHash || !planned.sourceHash) {
          selectorsModifiedDirect.push(formatted);
          selectorsModifiedDirectHex.push(planned.selector);
          selectorsModifiedDirectNames.push(functionName);
        } else {
          selectorsModifiedIndirect.push(formatted);
          selectorsModifiedIndirectHex.push(planned.selector);
          selectorsModifiedIndirectNames.push(functionName);
        }
      }
    }

    const hasChanges =
      bytecodeChanged ||
      abiChanged ||
      selectorsAdded.length > 0 ||
      selectorsRemoved.length > 0 ||
      selectorsModifiedDirect.length > 0 ||
      selectorsModifiedIndirect.length > 0 ||
      internalChanges.added.length > 0 ||
      internalChanges.removed.length > 0 ||
      internalChanges.modified.length > 0 ||
      eventChanges.added.length > 0 ||
      eventChanges.removed.length > 0;

    if (!hasChanges) {
      continue;
    }

    const facetName =
      plannedFacet.facetName ??
      previousFacet?.facetName ??
      plannedFacet.facetAddress ??
      previousFacet?.facetAddress;

    facets.push({
      facetName,
      bytecodeChanged,
      abiChanged,
      previousSelectorCount: previousFacet?.selectors?.length,
      plannedSelectorCount: plannedFacet?.selectors?.length,
      selectorsAdded,
      selectorsAddedNames,
      selectorsAddedDetail,
      selectorsRemoved,
      selectorsRemovedNames,
      selectorsRemovedDetail,
      selectorsModifiedDirect,
      selectorsModifiedDirectNames,
      selectorsModifiedIndirect,
      selectorsModifiedIndirectNames,
      selectorsAddedHex: selectorChanges.added.map((item) => item.selector),
      selectorsRemovedHex: selectorChanges.removed.map((item) => item.selector),
      selectorsModifiedDirectHex,
      selectorsModifiedIndirectHex,
      internalAdded: internalChanges.added,
      internalRemoved: internalChanges.removed,
      internalModified: internalChanges.modified,
      eventsAdded: eventChanges.added,
      eventsRemoved: eventChanges.removed,
    });
  }

  for (const [selector, facet] of Object.entries(selectorToPlannedFacet)) {
    const previousFacet = selectorToReferenceFacet[selector];
    if (!previousFacet) continue;

    const fromFacetLabel = previousFacet.facetName ?? "";
    const toFacetLabel = facet.facetName ?? "";

    if (!fromFacetLabel || !toFacetLabel || fromFacetLabel === toFacetLabel) {
      continue;
    }

    selectorMoves.push({
      selector,
      signature: facet.selectors.find((s) => s.selector === selector)
        ?.signature,
      fromFacet: fromFacetLabel,
      toFacet: toFacetLabel,
    });
  }

  for (const selector of removals) {
    const referenceFacet = selectorToReferenceFacet[selector];
    removalEntries.push({
      selector,
      signature: referenceFacet?.selectors.find(
        (s) => s.selector === selector
      )?.signature,
      fromFacet: referenceFacet?.facetName,
    });
  }

  let hasReferenceMismatch = false;
  if (reference && onChain) {
    const refSelectors = mapSelectorsToFacet(reference);
    const onChainSelectors = mapSelectorsToFacet(onChain);

    const refKeys = Object.keys(refSelectors);
    const onChainKeys = Object.keys(onChainSelectors);

    if (refKeys.length !== onChainKeys.length) {
      hasReferenceMismatch = true;
    } else {
      for (const key of refKeys) {
        const refFacet = refSelectors[key];
        const onChainFacet = onChainSelectors[key];
        if (
          !onChainFacet ||
          (refFacet.facetName ?? refFacet.facetAddress) !==
            (onChainFacet.facetName ?? onChainFacet.facetAddress)
        ) {
          hasReferenceMismatch = true;
          break;
        }
      }
    }
  }

  const diff: DiamondDiffReport = {
    diamondAddress: planned.diamondAddress,
    chainId: planned.chainId,
    referenceTimestamp: reference?.blockTimestamp,
    blockNumber: planned.blockNumber,
    generatedAt: Date.now(),
    hasReferenceMismatch,
    referenceCommit: reference?.commit,
    plannedCommit: planned.commit,
    facets,
    selectorMoves,
    removals: removalEntries,
    referenceMissing: !reference,
    summary: [],
  };

  diff.summary = buildReadableSummary(diff);
  return diff;
}

export async function persistDiffReport(
  hre: HardhatRuntimeEnvironment,
  diff: DiamondDiffReport
): Promise<string> {
  const chainId = await resolveChainId(hre);
  const baseDir = path.join(
    "state",
    "diamond",
    chainId.toString().toLowerCase()
  );
  const dir = path.join(baseDir, "diffs");
  ensureDir(dir);

  const facetSlug = diff.facets.length
    ? diff.facets
        .map((facet) => slugify(facet.facetName ?? "facet"))
        .filter(Boolean)
        .slice(0, 3)
        .join("__")
    : "no-changes";

  const timestamp = new Date(diff.generatedAt)
    .toISOString()
    .replace(/[:]/g, "-");

  const fileName = `${diff.diamondAddress
    .toLowerCase()
    .slice(0, 10)}-${facetSlug}-${timestamp}.json`;

  const filePath = path.join(dir, fileName);
  await fs.promises.writeFile(
    filePath,
    JSON.stringify(diff, null, 2),
    "utf8"
  );
  return path.relative(process.cwd(), filePath);
}

export function logDiffSummary(diff: DiamondDiffReport) {
  const RESET = "\x1b[0m";
  const BOLD = "\x1b[1m";
  const CYAN = "\x1b[36m";
  const GREEN = "\x1b[32m";
  const RED = "\x1b[31m";
  const YELLOW = "\x1b[33m";

  const maxLines = 12;
  let lines = diff.summary.length > maxLines
    ? [...diff.summary.slice(0, maxLines), `${YELLOW}  … see JSON diff for full details${RESET}`]
    : diff.summary;

  if (lines.length === 0) {
    return;
  }

  const maxWidth = 120;
  lines = lines.map((line) =>
    line.length > maxWidth ? `${line.slice(0, maxWidth - 1)}…` : line
  );

  const width = Math.max(...lines.map((line) => line.length));

  const colorize = (text: string, original: string): string => {
    if (original.startsWith("Diamond diff")) {
      return `${CYAN}${BOLD}${text}${RESET}`;
    }
    if (original.startsWith("Facet ")) {
      return `${BOLD}${text}${RESET}`;
    }
    if (original.startsWith("  Diamond impact:")) {
      return `${CYAN}${BOLD}${text}${RESET}`;
    }
    if (original.startsWith("  Source changes:")) {
      return `${CYAN}${BOLD}${text}${RESET}`;
    }
    if (original.includes("Added")) {
      return `${GREEN}${text}${RESET}`;
    }
    if (original.includes("Removed")) {
      return `${RED}${text}${RESET}`;
    }
    if (
      original.includes("Logic") ||
      original.includes("External functions affected") ||
      original.includes("Modified")
    ) {
      return `${YELLOW}${text}${RESET}`;
    }
    return text;
  };

  const topBorder = `${BOLD}┏${"━".repeat(width + 2)}┓${RESET}`;
  const bottomBorder = `${BOLD}┗${"━".repeat(width + 2)}┛${RESET}`;
  console.log(topBorder);
  lines.forEach((line) => {
    const padded = line.padEnd(width, " ");
    const colored = colorize(padded, line);
    console.log(`│ ${colored} │`);
  });
  console.log(bottomBorder);
}

function buildReadableSummary(diff: Omit<DiamondDiffReport, "summary"> & { summary?: string[] }): string[] {
  const lines: string[] = [];
  lines.push(
    `Diamond diff for ${diff.diamondAddress} (chain ${diff.chainId})`
  );

  if (diff.referenceMissing) {
    lines.push(
      "  ! No stored snapshot found. Captured current on-chain state as baseline; future reports will show diffs."
    );
  } else if (diff.hasReferenceMismatch) {
    lines.push(
      "  ! Reference snapshot differs from current on-chain state. Refresh the stored snapshot to trust this diff."
    );
  }

  if (
    diff.facets.length === 0 &&
    diff.selectorMoves.length === 0 &&
    diff.removals.length === 0
  ) {
    lines.push("  No facet-level differences detected.");
    return lines;
  }

  for (const facet of diff.facets) {
    const label = facet.facetName ?? "(unknown facet)";

    const diamondImpact: string[] = [];
    const sourceChanges: string[] = [];
    if (
      facet.previousSelectorCount !== undefined &&
      facet.plannedSelectorCount !== undefined &&
      facet.previousSelectorCount !== facet.plannedSelectorCount
    ) {
      diamondImpact.push(
        `Selector count: ${facet.previousSelectorCount} → ${facet.plannedSelectorCount}`
      );
    }
    if (facet.selectorsAdded.length) {
      diamondImpact.push(
        `Added externals (${facet.selectorsAdded.length}): ${formatList(facet.selectorsAddedNames.length ? facet.selectorsAddedNames : facet.selectorsAdded)}`
      );
    }
    if (facet.selectorsRemoved.length) {
      diamondImpact.push(
        `Removed externals (${facet.selectorsRemoved.length}): ${formatList(facet.selectorsRemovedNames.length ? facet.selectorsRemovedNames : facet.selectorsRemoved)}`
      );
    }
    if (facet.selectorsModifiedDirect.length) {
      diamondImpact.push(
        `Logic changed for existing externals (direct) (${facet.selectorsModifiedDirect.length}): ${formatList(facet.selectorsModifiedDirectNames.length ? facet.selectorsModifiedDirectNames : facet.selectorsModifiedDirect)}`
      );
      sourceChanges.push(
        `Modified external functions: ${formatList(facet.selectorsModifiedDirectNames.length ? facet.selectorsModifiedDirectNames : facet.selectorsModifiedDirect)}`
      );
    }
    if (facet.selectorsModifiedIndirect.length) {
      diamondImpact.push(
        `Logic changed via internal update (${facet.selectorsModifiedIndirect.length}): ${formatList(facet.selectorsModifiedIndirectNames.length ? facet.selectorsModifiedIndirectNames : facet.selectorsModifiedIndirect)}`
      );
      sourceChanges.push(
        `External functions affected via internal change: ${formatList(facet.selectorsModifiedIndirectNames.length ? facet.selectorsModifiedIndirectNames : facet.selectorsModifiedIndirect)}`
      );
    }
    if (
      facet.bytecodeChanged &&
      !facet.selectorsModifiedDirect.length &&
      !facet.selectorsModifiedIndirect.length
    ) {
      diamondImpact.push("Logic bytecode changed");
    }
    if (facet.abiChanged) {
      diamondImpact.push("ABI changed");
    }

    if (facet.internalAdded.length) {
      sourceChanges.push(
        `Added internal functions: ${formatList(facet.internalAdded)}`
      );
    }
    if (facet.internalRemoved.length) {
      sourceChanges.push(
        `Removed internal functions: ${formatList(facet.internalRemoved)}`
      );
    }
    if (facet.internalModified.length) {
      sourceChanges.push(
        `Modified internal functions: ${formatList(facet.internalModified)}`
      );
    }
    if (facet.eventsAdded.length) {
      sourceChanges.push(`Added events: ${formatList(facet.eventsAdded)}`);
    }
    if (facet.eventsRemoved.length) {
      sourceChanges.push(`Removed events: ${formatList(facet.eventsRemoved)}`);
    }

    if (!diamondImpact.length && !sourceChanges.length) {
      continue;
    }

    lines.push(`Facet ${label}`);
    if (diamondImpact.length) {
      lines.push("  Diamond impact:");
      diamondImpact.forEach((change) => lines.push(`    • ${change}`));
    }
    if (sourceChanges.length) {
      lines.push("  Source changes:");
      sourceChanges.forEach((change) => lines.push(`    • ${change}`));
    }
  }

  return lines;
}
