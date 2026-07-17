import { seededShuffle } from "../core/seededRandom.js";
import {
  bucketsToTeamPayload,
  genderOf,
  playerRating,
  MLP4_MALES,
  MLP4_FEMALES,
} from "./mlpFourConstraints.js";

function sortByRatingDesc(players = []) {
  return [...players].sort((a, b) => playerRating(b) - playerRating(a));
}

/**
 * Fill empty buckets by pairing indices of males/females.
 * malesAssigned[i] = [m1, m2], femalesAssigned[i] = [f1, f2]
 */
function zipGenderBuckets(malePairs, femalePairs, teamNames) {
  const teamCount = Math.min(malePairs.length, femalePairs.length);
  const buckets = [];
  for (let i = 0; i < teamCount; i += 1) {
    buckets.push([...(malePairs[i] || []), ...(femalePairs[i] || [])]);
  }
  return bucketsToTeamPayload(buckets, teamNames);
}

function pairStrongWeak(sorted = [], teamCount) {
  const pairs = Array.from({ length: teamCount }, () => []);
  const top = sorted.slice(0, teamCount);
  const bottom = sorted.slice(teamCount, teamCount * 2).reverse();
  for (let i = 0; i < teamCount; i += 1) {
    if (top[i]) pairs[i].push(top[i]);
    if (bottom[i]) pairs[i].push(bottom[i]);
  }
  return pairs;
}

function pairOppositeRank(sorted = [], teamCount) {
  const pairs = Array.from({ length: teamCount }, () => []);
  for (let i = 0; i < teamCount; i += 1) {
    const strong = sorted[i];
    const weak = sorted[teamCount * 2 - 1 - i];
    if (strong) pairs[i].push(strong);
    if (weak) pairs[i].push(weak);
  }
  return pairs;
}

function snakePairs(sorted = [], teamCount) {
  const pairs = Array.from({ length: teamCount }, () => []);
  let forward = true;
  let cursor = 0;
  for (const player of sorted.slice(0, teamCount * 2)) {
    pairs[cursor].push(player);
    if (forward) {
      if (cursor === teamCount - 1) forward = false;
      else cursor += 1;
    } else if (cursor === 0) {
      forward = true;
    } else {
      cursor -= 1;
    }
  }
  return pairs;
}

function ratingBucketShuffle(sorted = [], teamCount, rng) {
  const need = teamCount * 2;
  const pool = sorted.slice(0, need);
  const high = seededShuffle(pool.slice(0, teamCount), rng);
  const low = seededShuffle(pool.slice(teamCount), rng);
  const pairs = Array.from({ length: teamCount }, () => []);
  for (let i = 0; i < teamCount; i += 1) {
    if (high[i]) pairs[i].push(high[i]);
    if (low[i]) pairs[i].push(low[i]);
  }
  return pairs;
}

function randomBalancedPairs(sorted = [], teamCount, rng) {
  const shuffled = seededShuffle(sorted.slice(0, teamCount * 2), rng);
  const pairs = Array.from({ length: teamCount }, () => []);
  shuffled.forEach((player, index) => {
    pairs[index % teamCount].push(player);
  });
  // repair to exactly 2
  const flat = pairs.flat();
  const repaired = Array.from({ length: teamCount }, () => []);
  flat.forEach((player, index) => {
    repaired[Math.floor(index / 2) % teamCount].push(player);
  });
  // ensure size 2 by redistribution
  const all = repaired.flat();
  const out = [];
  for (let i = 0; i < teamCount; i += 1) {
    out.push(all.slice(i * 2, i * 2 + 2));
  }
  return out;
}

/**
 * Build initial MLP4 candidates from multiple strategies.
 * `fourStepBuilder` injects buildMlpTeamsFourStep without circular imports.
 */
export function generateMlpFourInitialCandidates({
  males = [],
  females = [],
  teamCount,
  teamNames = [],
  rng,
  fourStepBuilder,
  maxCandidates = 250,
} = {}) {
  const maleSorted = sortByRatingDesc(males);
  const femaleSorted = sortByRatingDesc(females);
  const candidates = [];

  const pushFromBuckets = (buckets, strategy) => {
    if (!buckets || candidates.length >= maxCandidates) return;
    const teams = Array.isArray(buckets[0]?.playerIds)
      ? buckets
      : bucketsToTeamPayload(buckets, teamNames);
    candidates.push({
      strategy,
      teams: teams.map((team, index) => ({
        ...team,
        name: teamNames[index] || team.name || `Đội ${index + 1}`,
      })),
    });
  };

  // 1) Four-step baseline (multiple seeded shuffles)
  if (typeof fourStepBuilder === "function") {
    const baselineCount = Math.min(48, Math.max(8, Math.floor(maxCandidates / 5)));
    for (let i = 0; i < baselineCount && candidates.length < maxCandidates; i += 1) {
      const buckets = fourStepBuilder({
        males: maleSorted,
        females: femaleSorted,
        teamCount,
        randomFn: rng,
      });
      pushFromBuckets(buckets, i === 0 ? "four_step_baseline" : `four_step_${i}`);
    }
  }

  // 2) Strong-with-weak
  pushFromBuckets(
    zipGenderBuckets(
      pairStrongWeak(maleSorted, teamCount),
      pairStrongWeak(femaleSorted, teamCount),
      teamNames
    ).map((t) => t.members || []),
    "strong_weak"
  );
  // zipGenderBuckets already returns team payloads — fix push
  // Actually above is wrong. Let me push properly:
  candidates.pop(); // remove broken push if any — safer rewrite below

  // Clear and rebuild cleanly
  candidates.length = 0;

  if (typeof fourStepBuilder === "function") {
    const baselineCount = Math.min(48, Math.max(8, Math.floor(maxCandidates / 5)));
    for (let i = 0; i < baselineCount && candidates.length < maxCandidates; i += 1) {
      const buckets = fourStepBuilder({
        males: maleSorted,
        females: femaleSorted,
        teamCount,
        randomFn: rng,
      });
      candidates.push({
        strategy: i === 0 ? "four_step_baseline" : `four_step_${i}`,
        teams: bucketsToTeamPayload(buckets, teamNames),
      });
    }
  }

  const strategies = [
    ["strong_weak", pairStrongWeak, pairStrongWeak],
    ["opposite_rank", pairOppositeRank, pairOppositeRank],
    ["snake", snakePairs, snakePairs],
  ];

  for (const [name, maleFn, femaleFn] of strategies) {
    if (candidates.length >= maxCandidates) break;
    candidates.push({
      strategy: name,
      teams: zipGenderBuckets(
        maleFn(maleSorted, teamCount),
        femaleFn(femaleSorted, teamCount),
        teamNames
      ),
    });
  }

  // Cross strategies
  if (candidates.length < maxCandidates) {
    candidates.push({
      strategy: "strong_male_snake_female",
      teams: zipGenderBuckets(
        pairStrongWeak(maleSorted, teamCount),
        snakePairs(femaleSorted, teamCount),
        teamNames
      ),
    });
  }
  if (candidates.length < maxCandidates) {
    candidates.push({
      strategy: "snake_male_opposite_female",
      teams: zipGenderBuckets(
        snakePairs(maleSorted, teamCount),
        pairOppositeRank(femaleSorted, teamCount),
        teamNames
      ),
    });
  }

  // Controlled rating-bucket shuffles
  const bucketVariants = Math.min(40, Math.max(8, Math.floor(maxCandidates / 4)));
  for (let i = 0; i < bucketVariants && candidates.length < maxCandidates; i += 1) {
    candidates.push({
      strategy: `rating_bucket_${i}`,
      teams: zipGenderBuckets(
        ratingBucketShuffle(maleSorted, teamCount, rng),
        ratingBucketShuffle(femaleSorted, teamCount, rng),
        teamNames
      ),
    });
  }

  // Seeded random balanced variants
  const randomVariants = Math.min(40, Math.max(8, Math.floor(maxCandidates / 4)));
  for (let i = 0; i < randomVariants && candidates.length < maxCandidates; i += 1) {
    candidates.push({
      strategy: `random_balanced_${i}`,
      teams: zipGenderBuckets(
        randomBalancedPairs(maleSorted, teamCount, rng),
        randomBalancedPairs(femaleSorted, teamCount, rng),
        teamNames
      ),
    });
  }

  return candidates.slice(0, maxCandidates);
}

export function splitPoolByGender(players = []) {
  const males = [];
  const females = [];
  const unknown = [];
  for (const player of players) {
    const g = genderOf(player);
    if (g === "male") males.push(player);
    else if (g === "female") females.push(player);
    else unknown.push(player);
  }
  return {
    males: sortByRatingDesc(males),
    females: sortByRatingDesc(females),
    unknown,
  };
}

// silence unused import lint if any
void MLP4_MALES;
void MLP4_FEMALES;
