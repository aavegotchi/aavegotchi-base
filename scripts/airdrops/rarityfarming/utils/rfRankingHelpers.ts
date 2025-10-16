export interface RfRoundData {
  rarityGotchis: string[];
  kinshipGotchis: string[];
  xpGotchis: string[];
}

interface RankingEntry {
  gotchiId: string;
  score: number;
  roundsParticipated: number;
  earliestIndex: number;
  tiebreakerScore: number;
}

const categoryTieBreaker: Record<string, number> = {
  rarity: 2,
  kinship: 1,
  xp: 0,
};

export function getRankingWithTieBreakers(
  rounds: string[][],
  category: keyof typeof categoryTieBreaker
): number[] {
  const scores = new Map<number, RankingEntry>();

  rounds.forEach((round) => {
    round.forEach((id, idx) => {
      const gotchiId = Number(id);
      if (!scores.has(gotchiId)) {
        scores.set(gotchiId, {
          gotchiId,
          score: 0,
          roundsParticipated: 0,
          earliestIndex: idx,
          tiebreakerScore: 0,
        });
      }
      const entry = scores.get(gotchiId)!;
      entry.score += idx;
      entry.roundsParticipated += 1;
      entry.earliestIndex = Math.min(entry.earliestIndex, idx);
    });
  });

  const tieIndex = categoryTieBreaker[category];

  const ranking = Array.from(scores.values());

  ranking.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    if (a.roundsParticipated !== b.roundsParticipated)
      return b.roundsParticipated - a.roundsParticipated;
    if (a.earliestIndex !== b.earliestIndex)
      return a.earliestIndex - b.earliestIndex;

    if (tieIndex >= 0) {
      const tieA = Number(
        a.gotchiId.toString().charAt(tieIndex) ||
          a.gotchiId.toString().slice(-1)
      );
      const tieB = Number(
        b.gotchiId.toString().charAt(tieIndex) ||
          b.gotchiId.toString().slice(-1)
      );
      if (tieA !== tieB) return tieA - tieB;
    }

    return Number(a.gotchiId) - Number(b.gotchiId);
  });

  return ranking.map((entry) => Number(entry.gotchiId));
}

export function getUniqueRfPlayers(roundGroups: string[][][]): number[] {
  const set = new Set<number>();
  roundGroups.forEach((rounds) => {
    rounds.forEach((round) => {
      round.forEach((gotchiId) => set.add(Number(gotchiId)));
    });
  });
  return Array.from(set).sort((a, b) => a - b);
}

export function validateNoDuplicates(ids: number[]): void {
  const seen = new Set<number>();
  for (const id of ids) {
    if (seen.has(id)) {
      throw new Error(`Duplicate gotchi ID detected: ${id}`);
    }
    seen.add(id);
  }
}
