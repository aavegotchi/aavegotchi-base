export interface XPDropTrackingEntry {
  agip_number: number;
  title: string;
  status: "not_created" | "pending" | "deployed";
  sigprop_script?: string;
  coreprop_script?: string;
  sigprop_id: string;
  coreprop_id: string;
  created_date?: string;
  deployed_date?: string;
  tx_hash?: string;
}

export interface XPDropTracking {
  [key: string]: XPDropTrackingEntry;
}

export interface DeploymentOptions {
  agipNumbers?: Set<number>;
  isDryRun: boolean;
}

export function parseAGIPSelection(selection: string): number[] {
  const agips = new Set<number>();

  for (const rawToken of selection.split(",")) {
    const token = rawToken.trim();

    if (!token) {
      continue;
    }

    const rangeMatch = token.match(/^(\d+)-(\d+)$/);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10);
      const end = parseInt(rangeMatch[2], 10);
      const [from, to] = start <= end ? [start, end] : [end, start];

      for (let agip = from; agip <= to; agip++) {
        agips.add(agip);
      }
      continue;
    }

    const agip = parseInt(token, 10);
    if (Number.isNaN(agip)) {
      throw new Error(`Invalid AGIP selection token: ${token}`);
    }

    agips.add(agip);
  }

  return Array.from(agips).sort((a, b) => a - b);
}

function readCliValue(argv: string[], flag: string): string | undefined {
  const prefix = `${flag}=`;
  const inlineValue = argv.find((arg) => arg.startsWith(prefix));

  if (inlineValue) {
    return inlineValue.slice(prefix.length);
  }

  const flagIndex = argv.indexOf(flag);
  if (flagIndex === -1) {
    return undefined;
  }

  return argv[flagIndex + 1];
}

export function parseDeploymentOptions(
  argv: string[],
  env: NodeJS.ProcessEnv = process.env
): DeploymentOptions {
  const agipSelection =
    readCliValue(argv, "--agips") ?? env.AGIP_IDS ?? env.AGIPS;

  return {
    agipNumbers: agipSelection
      ? new Set(parseAGIPSelection(agipSelection))
      : undefined,
    isDryRun: argv.includes("--dry-run") || env.DRY_RUN === "true",
  };
}

export function filterPendingAGIPs(
  tracking: XPDropTracking,
  options: DeploymentOptions
): XPDropTrackingEntry[] {
  const pending = Object.values(tracking)
    .filter((entry) => entry.status === "pending")
    .sort((a, b) => a.agip_number - b.agip_number);

  if (!options.agipNumbers || options.agipNumbers.size === 0) {
    return pending;
  }

  return pending.filter((entry) => options.agipNumbers!.has(entry.agip_number));
}
