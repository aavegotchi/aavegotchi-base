import { request, gql } from "graphql-request";
import * as fs from "fs";
import * as path from "path";

interface SnapshotProposal {
  id: string;
  title: string;
  body: string;
  state: string;
  scores: number[];
  scores_total: number;
  votes: number;
  quorum: number;
  created: number;
  end: number;
  author: string;
  choices: string[];
  snapshot: string;
  space: {
    id: string;
    name: string;
  };
}

interface ProposalPair {
  sigprop: SnapshotProposal;
  coreprop: SnapshotProposal;
  similarity: number;
}

const SNAPSHOT_ENDPOINT = "https://hub.snapshot.org/graphql";
const SPACE_ID = "aavegotchi.eth";

// Quorum thresholds
const NEWER_QUORUM = 7.2e6; // 7.2 million
const OLDER_QUORUM = 9e6; // 9 million

const QUERY = gql`
  query GetProposals($space: String!, $first: Int!) {
    proposals(
      where: { space: $space }
      first: $first
      orderBy: "created"
      orderDirection: desc
    ) {
      id
      title
      body
      state
      scores
      scores_total
      votes
      quorum
      created
      end
      author
      choices
      snapshot
      space {
        id
        name
      }
    }
  }
`;

async function fetchProposals(): Promise<SnapshotProposal[]> {
  console.log(`Fetching latest 250 proposals from ${SPACE_ID}...`);

  try {
    const data = await request(SNAPSHOT_ENDPOINT, QUERY, {
      space: SPACE_ID,
      first: 250,
    });
    return data.proposals;
  } catch (error) {
    console.error("Error fetching proposals:", error);
    throw error;
  }
}

function hasReachedQuorum(proposal: SnapshotProposal): boolean {
  // Use the proposal's explicit quorum if available, otherwise use our fallback thresholds
  if (proposal.quorum && proposal.quorum > 0) {
    return proposal.scores_total >= proposal.quorum;
  }

  // Fallback to our known thresholds based on proposal age
  // You might want to adjust this logic based on actual proposal dates
  const threshold =
    proposal.scores_total >= NEWER_QUORUM ? NEWER_QUORUM : OLDER_QUORUM;
  return proposal.scores_total >= threshold;
}

function hasPassed(proposal: SnapshotProposal): boolean {
  if (!proposal.scores || proposal.scores.length === 0) {
    return false;
  }

  const scores = proposal.scores;
  const totalVotes = proposal.scores_total;
  const numOptions = scores.length;

  // Find the winning option (highest votes)
  const maxVotes = Math.max(...scores);
  const winningIndex = scores.indexOf(maxVotes);

  // Calculate percentages
  const percentages = scores.map((score) => (score / totalVotes) * 100);
  const winningPercentage = percentages[winningIndex];

  // Find the second highest percentage to calculate differential
  const sortedPercentages = [...percentages].sort((a, b) => b - a);
  const secondHighestPercentage = sortedPercentages[1] || 0;
  const differential = winningPercentage - secondHighestPercentage;

  // Apply Aavegotchi DAO voting rules based on number of options
  let requiredDifferential: number;

  switch (numOptions) {
    case 2:
      requiredDifferential = 10; // 10% differential for 2 options
      break;
    case 3:
      requiredDifferential = 15; // 15% differential for 3 options
      break;
    case 4:
      requiredDifferential = 20; // 20% differential for 4 options
      break;
    default:
      // For 5+ options, extrapolate the pattern (add 5% per additional option)
      requiredDifferential = 20 + (numOptions - 4) * 5;
      break;
  }

  // Proposal passes if the winning option has the required differential
  return differential >= requiredDifferential;
}

function isCoreprop(proposal: SnapshotProposal): boolean {
  return proposal.title.includes("AGIP") || proposal.title.includes("[AGIP]");
}

function calculateSimilarity(text1: string, text2: string): number {
  // Simple similarity calculation using Levenshtein distance
  // Normalize texts for comparison and limit length for performance
  const normalized1 = text1
    .toLowerCase()
    .replace(/\[agip\]/gi, "")
    .trim()
    .substring(0, 500); // Limit to first 500 chars for performance
  const normalized2 = text2.toLowerCase().trim().substring(0, 500);

  // Calculate Levenshtein distance
  const distance = levenshteinDistance(normalized1, normalized2);
  const maxLength = Math.max(normalized1.length, normalized2.length);

  if (maxLength === 0) return 1;

  return 1 - distance / maxLength;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1)
    .fill(null)
    .map(() => Array(str1.length + 1).fill(null));

  for (let i = 0; i <= str1.length; i++) {
    matrix[0][i] = i;
  }

  for (let j = 0; j <= str2.length; j++) {
    matrix[j][0] = j;
  }

  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // deletion
        matrix[j - 1][i] + 1, // insertion
        matrix[j - 1][i - 1] + indicator // substitution
      );
    }
  }

  return matrix[str2.length][str1.length];
}

function findBestMatch(
  sigprop: SnapshotProposal,
  coreprops: SnapshotProposal[]
): SnapshotProposal | null {
  let bestMatch: SnapshotProposal | null = null;
  let bestSimilarity = 0;

  for (const coreprop of coreprops) {
    // Compare titles first
    const titleSimilarity = calculateSimilarity(sigprop.title, coreprop.title);

    // If title similarity is high enough, consider it a match
    if (titleSimilarity > 0.6) {
      if (titleSimilarity > bestSimilarity) {
        bestSimilarity = titleSimilarity;
        bestMatch = coreprop;
      }
      continue;
    }

    // If title similarity is low, compare content/body
    const bodySimilarity = calculateSimilarity(sigprop.body, coreprop.body);
    const combinedSimilarity = (titleSimilarity + bodySimilarity) / 2;

    if (combinedSimilarity > 0.5 && combinedSimilarity > bestSimilarity) {
      bestSimilarity = combinedSimilarity;
      bestMatch = coreprop;
    }
  }

  return bestMatch;
}

function matchProposals(
  sigprops: SnapshotProposal[],
  coreprops: SnapshotProposal[]
): ProposalPair[] {
  const pairs: ProposalPair[] = [];
  const usedCoreprops = new Set<string>();

  for (const sigprop of sigprops) {
    const availableCoreprops = coreprops.filter(
      (cp) => !usedCoreprops.has(cp.id)
    );
    const bestMatch = findBestMatch(sigprop, availableCoreprops);

    if (bestMatch) {
      const similarity = Math.max(
        calculateSimilarity(sigprop.title, bestMatch.title),
        (calculateSimilarity(sigprop.title, bestMatch.title) +
          calculateSimilarity(sigprop.body, bestMatch.body)) /
          2
      );

      pairs.push({
        sigprop,
        coreprop: bestMatch,
        similarity,
      });

      usedCoreprops.add(bestMatch.id);
    }
  }

  return pairs;
}

function formatProposal(proposal: SnapshotProposal): any {
  return {
    id: proposal.id,
    title: proposal.title,
    state: proposal.state,
    votes: proposal.votes,
    scores_total: proposal.scores_total,
    scores: proposal.scores,
    quorum: proposal.quorum,
    created: new Date(proposal.created * 1000).toISOString(),
    end: new Date(proposal.end * 1000).toISOString(),
    author: proposal.author,
    choices: proposal.choices,
    snapshot: proposal.snapshot,
    body_preview:
      proposal.body.substring(0, 200) +
      (proposal.body.length > 200 ? "..." : ""),
  };
}

interface XPDropTrackingEntry {
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

interface XPDropTracking {
  [key: string]: XPDropTrackingEntry; // key format: "agip_XXX"
}

function generateScriptContent(
  proposalId: string,
  isCoreprop: boolean
): string {
  const template = `import { run } from "hardhat";

async function addXPDrop() {
  const propId =
    "${proposalId}";

  await run("deployXPDrop", {
    proposalId: propId,
  });
}

addXPDrop()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });${isCoreprop ? "" : "\n\nexports.grantXP = addXPDrop;"}
`;
  return template;
}

async function generateXPDropScripts(
  matchedPairs: ProposalPair[]
): Promise<void> {
  console.log("\n🎯 Generating XP Drop scripts...");

  // Load existing tracking data
  const trackingPath = path.join(__dirname, "xp-drop-tracking.json");
  let tracking: XPDropTracking = {};

  try {
    if (fs.existsSync(trackingPath)) {
      tracking = JSON.parse(fs.readFileSync(trackingPath, "utf8"));
    }
  } catch (error) {
    console.log("Creating new XP drop tracking file...");
  }

  let newScriptsCreated = 0;
  let existingEntriesUpdated = 0;

  for (const pair of matchedPairs) {
    // Extract AGIP number
    const agipMatch = pair.coreprop.title.match(/\[?AGIP[\s\-]*(\d+)\]?/i);
    if (!agipMatch) continue;

    const agipNumber = parseInt(agipMatch[1]);
    const agipKey = `agip_${agipNumber}`;
    const cleanTitle = pair.coreprop.title.replace(
      /^\[AGIP[\s\-]*\d+\]\s*/i,
      ""
    );

    // Define script paths
    const sigpropScriptPath = `scripts/airdrops/sigprops/merkle/grantXP_agip${agipNumber}.ts`;
    const corepropScriptPath = `scripts/airdrops/coreprops/merkle/grantXP_agip${agipNumber}_coreprop.ts`;

    // Check if scripts already exist on disk
    const sigpropFullPath = path.join(__dirname, "..", sigpropScriptPath);
    const corepropFullPath = path.join(__dirname, "..", corepropScriptPath);
    const sigpropExists = fs.existsSync(sigpropFullPath);
    const corepropExists = fs.existsSync(corepropFullPath);
    const bothScriptsExist = sigpropExists && corepropExists;

    // AGIPs up to and including 141 are deployed (data in another repo)
    // AGIPs 142+ are pending (checked via xpDrops folders)
    let isDeployed = false;
    let isPending = false;
    
    if (agipNumber <= 141) {
      // AGIPs 1-141 are considered deployed (data in another repo)
      isDeployed = bothScriptsExist;
      isPending = false;
    } else {
      // AGIPs 142+ check actual deployment via xpDrops folders
      const sigpropXpDropPath = path.join(
        __dirname,
        "airdrops",
        "xpDrops",
        pair.sigprop.id
      );
      const corepropXpDropPath = path.join(
        __dirname,
        "airdrops",
        "xpDrops",
        pair.coreprop.id
      );
      const sigpropDeployed = fs.existsSync(sigpropXpDropPath);
      const corepropDeployed = fs.existsSync(corepropXpDropPath);
      const bothDeployed = sigpropDeployed && corepropDeployed;
      
      isDeployed = bothDeployed;
      isPending = bothScriptsExist && !isDeployed;
    }

    // Check if entry exists in tracking
    if (!tracking[agipKey]) {
      // Create new entry
      let status: "not_created" | "pending" | "deployed" = "not_created";
      if (isDeployed) {
        status = "deployed";
      } else if (isPending) {
        status = "pending";
      }

      tracking[agipKey] = {
        agip_number: agipNumber,
        title: cleanTitle,
        status: status,
        sigprop_id: pair.sigprop.id,
        coreprop_id: pair.coreprop.id,
        created_date: new Date().toISOString(),
      };

      if (bothScriptsExist) {
        tracking[agipKey].sigprop_script = sigpropScriptPath;
        tracking[agipKey].coreprop_script = corepropScriptPath;

        if (isDeployed) {
          tracking[agipKey].deployed_date = new Date().toISOString();
        }
      }

      newScriptsCreated++;
    } else {
      // Update existing entry (in case titles changed or IDs were updated)
      tracking[agipKey].title = cleanTitle;
      tracking[agipKey].sigprop_id = pair.sigprop.id;
      tracking[agipKey].coreprop_id = pair.coreprop.id;

      // Update status based on deployment rules
      if (isDeployed && tracking[agipKey].status !== "deployed") {
        tracking[agipKey].status = "deployed";
        if (bothScriptsExist) {
          tracking[agipKey].sigprop_script = sigpropScriptPath;
          tracking[agipKey].coreprop_script = corepropScriptPath;
        }
        tracking[agipKey].deployed_date = new Date().toISOString();
      } else if (isPending && tracking[agipKey].status !== "pending") {
        tracking[agipKey].status = "pending";
        tracking[agipKey].sigprop_script = sigpropScriptPath;
        tracking[agipKey].coreprop_script = corepropScriptPath;
        // Remove deployed_date if it was previously set incorrectly
        delete tracking[agipKey].deployed_date;
      } else if (!isDeployed && !isPending && bothScriptsExist) {
        // Scripts exist but not deployed, should be pending
        tracking[agipKey].status = "pending";
        tracking[agipKey].sigprop_script = sigpropScriptPath;
        tracking[agipKey].coreprop_script = corepropScriptPath;
        delete tracking[agipKey].deployed_date;
      }

      existingEntriesUpdated++;
    }

    // Generate scripts if they don't exist and status is not_created
    if (tracking[agipKey].status === "not_created") {
      // Generate sigprop script
      if (!sigpropExists) {
        const sigpropContent = generateScriptContent(pair.sigprop.id, false);

        // Ensure directory exists
        const sigpropDir = path.dirname(sigpropFullPath);
        if (!fs.existsSync(sigpropDir)) {
          fs.mkdirSync(sigpropDir, { recursive: true });
        }

        fs.writeFileSync(sigpropFullPath, sigpropContent);
        console.log(`  ✅ Created sigprop script: ${sigpropScriptPath}`);
      }

      // Generate coreprop script
      if (!corepropExists) {
        const corepropContent = generateScriptContent(pair.coreprop.id, true);

        // Ensure directory exists
        const corepropDir = path.dirname(corepropFullPath);
        if (!fs.existsSync(corepropDir)) {
          fs.mkdirSync(corepropDir, { recursive: true });
        }

        fs.writeFileSync(corepropFullPath, corepropContent);
        console.log(`  ✅ Created coreprop script: ${corepropScriptPath}`);
      }

      // Update status to pending since scripts are now created
      tracking[agipKey].status = "pending";
      tracking[agipKey].sigprop_script = sigpropScriptPath;
      tracking[agipKey].coreprop_script = corepropScriptPath;
    }
  }

  // Sort tracking data by AGIP number (highest to lowest) before saving
  const sortedTracking: XPDropTracking = {};
  const sortedKeys = Object.keys(tracking).sort((a, b) => {
    const agipA = tracking[a].agip_number;
    const agipB = tracking[b].agip_number;
    return agipB - agipA; // Sort descending (highest first)
  });

  for (const key of sortedKeys) {
    sortedTracking[key] = tracking[key];
  }

  // Save updated tracking data
  fs.writeFileSync(trackingPath, JSON.stringify(sortedTracking, null, 2));

  console.log(`📊 XP Drop Script Summary:`);
  console.log(`   - New entries created: ${newScriptsCreated}`);
  console.log(`   - Existing entries updated: ${existingEntriesUpdated}`);
  console.log(`   - Total tracked AGIPs: ${Object.keys(tracking).length}`);
  console.log(`💾 Tracking data saved to: ${trackingPath}`);

  // Display status summary
  const statusCounts = Object.values(tracking).reduce((acc, entry) => {
    acc[entry.status] = (acc[entry.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log(`📈 Status breakdown:`);
  Object.entries(statusCounts).forEach(([status, count]) => {
    const emoji =
      status === "deployed" ? "✅" : status === "pending" ? "⏳" : "🚧";
    console.log(`   ${emoji} ${status}: ${count}`);
  });
}

async function main() {
  try {
    console.log("🚀 Starting Snapshot proposal analysis...\n");

    // Fetch proposals
    const allProposals = await fetchProposals();
    console.log(`📥 Fetched ${allProposals.length} proposals\n`);

    // Filter for proposals that reached quorum and passed
    const qualifiedProposals = allProposals.filter((proposal) => {
      const reachedQuorum = hasReachedQuorum(proposal);
      const passed = hasPassed(proposal);
      return reachedQuorum && passed;
    });

    console.log(
      `✅ Found ${qualifiedProposals.length} proposals that reached quorum and passed\n`
    );

    // Separate into sigprops and coreprops
    const sigprops = qualifiedProposals.filter((p) => !isCoreprop(p));
    const coreprops = qualifiedProposals.filter((p) => isCoreprop(p));

    console.log(`📊 Breakdown:`);
    console.log(`   - Sigprops: ${sigprops.length}`);
    console.log(`   - Coreprops: ${coreprops.length}\n`);

    // Match sigprops to coreprops
    const matchedPairs = matchProposals(sigprops, coreprops);

    console.log(
      `🔗 Found ${matchedPairs.length} matched sigprop/coreprop pairs:\n`
    );

    // Display quick list of passed AGIPs
    console.log("📋 **PASSED AGIPs (Sigprop + Coreprop):**");
    matchedPairs
      .map((pair) => {
        const agipMatch = pair.coreprop.title.match(/\[?AGIP[\s\-]*(\d+)\]?/i);
        const agipNumber = agipMatch ? parseInt(agipMatch[1]) : null;
        return {
          agip_number: agipNumber,
          title: pair.coreprop.title.replace(/^\[AGIP[\s\-]*\d+\]\s*/i, ""),
        };
      })
      .sort((a, b) => (b.agip_number || 0) - (a.agip_number || 0))
      .forEach((agip) => {
        console.log(`   AGIP ${agip.agip_number}: ${agip.title}`);
      });
    console.log("");

    // Display results
    matchedPairs.forEach((pair, index) => {
      console.log(
        `\n--- PAIR ${index + 1} (Similarity: ${(pair.similarity * 100).toFixed(
          1
        )}%) ---`
      );

      console.log("\n🗳️  SIGPROP:");
      console.log(JSON.stringify(formatProposal(pair.sigprop), null, 2));

      console.log("\n📋 COREPROP:");
      console.log(JSON.stringify(formatProposal(pair.coreprop), null, 2));

      console.log("\n" + "=".repeat(80));
    });

    // Save results to JSON file
    const outputData = {
      summary: {
        total_proposals_fetched: allProposals.length,
        qualified_proposals: qualifiedProposals.length,
        sigprops_count: sigprops.length,
        coreprops_count: coreprops.length,
        matched_pairs_count: matchedPairs.length,
        analysis_date: new Date().toISOString(),
      },
      passed_agips: matchedPairs
        .map((pair) => {
          // Extract AGIP number from coreprop title
          const agipMatch = pair.coreprop.title.match(
            /\[?AGIP[\s\-]*(\d+)\]?/i
          );
          const agipNumber = agipMatch ? parseInt(agipMatch[1]) : null;

          return {
            agip_number: agipNumber,
            title: pair.coreprop.title.replace(/^\[AGIP[\s\-]*\d+\]\s*/i, ""),
            full_coreprop_title: pair.coreprop.title,
            sigprop_id: pair.sigprop.id,
            coreprop_id: pair.coreprop.id,
            similarity_percentage: parseFloat(
              (pair.similarity * 100).toFixed(1)
            ),
          };
        })
        .sort((a, b) => (b.agip_number || 0) - (a.agip_number || 0)), // Sort by AGIP number descending
      matched_pairs: matchedPairs.map((pair, index) => ({
        pair_number: index + 1,
        similarity_percentage: parseFloat((pair.similarity * 100).toFixed(1)),
        sigprop: formatProposal(pair.sigprop),
        coreprop: formatProposal(pair.coreprop),
      })),
      all_qualified_sigprops: sigprops.map(formatProposal),
      all_qualified_coreprops: coreprops.map(formatProposal),
    };

    const outputPath = path.join(__dirname, "snapshot-analysis-results.json");
    fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));

    console.log(`\n💾 Results saved to: ${outputPath}`);

    // Generate XP drop scripts and update tracking
    await generateXPDropScripts(matchedPairs);

    // Validate AGIP sequence for gaps
    console.log("\n🔍 Validating AGIP sequence...");
    const agipNumbers = matchedPairs
      .map((pair) => {
        const agipMatch = pair.coreprop.title.match(/\[?AGIP[\s\-]*(\d+)\]?/i);
        return agipMatch ? parseInt(agipMatch[1]) : null;
      })
      .filter((num): num is number => num !== null)
      .sort((a, b) => b - a); // Sort descending (newest first)

    console.log(`Found AGIPs: ${agipNumbers.length} total`);
    console.log(
      `Range: AGIP ${agipNumbers[agipNumbers.length - 1]} to AGIP ${
        agipNumbers[0]
      }`
    );

    // Check for gaps in the sequence
    const missingAGIPs: number[] = [];
    let maxAGIP = 0;
    let minAGIP = 0;

    if (agipNumbers.length > 1) {
      minAGIP = Math.min(...agipNumbers);
      maxAGIP = Math.max(...agipNumbers);

      for (let i = minAGIP; i <= maxAGIP; i++) {
        if (!agipNumbers.includes(i)) {
          missingAGIPs.push(i);
        }
      }
    }

    if (missingAGIPs.length > 0) {
      console.log(`\n❌ MISSING AGIPs DETECTED: ${missingAGIPs.join(", ")}`);
      console.log("\nPossible reasons for missing AGIPs:");
      console.log("1. Sigprop didn't reach quorum or pass");
      console.log("2. Coreprop didn't reach quorum or pass");
      console.log("3. Fuzzy matching failed to pair sigprop with coreprop");
      console.log("4. AGIP number was skipped intentionally");
      console.log("5. Different title format not handled by regex");

      // List missing AGIPs with more detail
      console.log("\n🔎 Detailed analysis of missing AGIPs:");
      for (const missingAGIP of missingAGIPs) {
        const corepropExists = coreprops.find((cp) =>
          cp.title.match(new RegExp(`AGIP[\\s\\-]*${missingAGIP}`, "i"))
        );
        const sigpropExists = sigprops.find(
          (sp) =>
            sp.title.toLowerCase().includes(`agip ${missingAGIP}`) ||
            sp.title.toLowerCase().includes(`agip-${missingAGIP}`) ||
            sp.title.toLowerCase().includes(`agip${missingAGIP}`)
        );

        console.log(`  AGIP ${missingAGIP}:`);
        console.log(`    - Coreprop found: ${corepropExists ? "✅" : "❌"}`);
        console.log(`    - Sigprop found: ${sigpropExists ? "✅" : "❌"}`);

        if (corepropExists && !sigpropExists) {
          console.log(
            `    - Issue: Coreprop exists but no matching sigprop passed`
          );
        } else if (!corepropExists && sigpropExists) {
          console.log(
            `    - Issue: Sigprop exists but no matching coreprop passed`
          );
        } else if (!corepropExists && !sigpropExists) {
          console.log(
            `    - Issue: Neither sigprop nor coreprop found that passed`
          );
        } else {
          console.log(`    - Issue: Both exist but fuzzy matching failed`);
        }
      }

      // Throw error if there are missing AGIPs in a very recent range (last 5)
      const recentThreshold = maxAGIP - 5; // Check last 5 AGIPs for completeness
      const recentMissing = missingAGIPs.filter(
        (agip) => agip > recentThreshold
      );

      if (recentMissing.length > 0) {
        console.log(
          `\n⚠️  WARNING: Missing very recent AGIPs: ${recentMissing.join(
            ", "
          )}`
        );
        console.log(
          "This might indicate an issue with proposal fetching or that these AGIPs haven't completed the full process yet."
        );

        // Only throw error if there are more than 2 recent missing (suggesting systematic issue)
        if (recentMissing.length > 2) {
          throw new Error(
            `❌ CRITICAL: Too many recent AGIPs missing (${
              recentMissing.length
            }): ${recentMissing.join(", ")}. ` +
              `This suggests a systematic issue with our proposal fetching or filtering logic.`
          );
        }
      }
    } else {
      console.log("✅ No gaps detected in AGIP sequence!");
    }

    if (matchedPairs.length === 0) {
      console.log("No matched pairs found. This could mean:");
      console.log("- No proposals have both sigprop and coreprop that passed");
      console.log("- The matching algorithm needs adjustment");
      console.log("- The quorum/passing criteria need refinement");
    }
  } catch (error) {
    console.error("❌ Error running analysis:", error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

export { main, fetchProposals, matchProposals };
