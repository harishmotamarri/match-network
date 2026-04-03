export interface CandidateProfile {
    userId: string;
    name: string;
    city: string | null;
    latitude: number | null;
    longitude: number | null;
    experienceLevel: string | null;
    availability: string;
    reputationScore: number;
    isPremium: boolean;
    skills: { skillId: string; proficiencyLevel: number }[];
    interests: { category: string; value: string }[];
    acceptedConnectionsCount: number;
}

export interface RequesterContext {
    requiredSkillIds: string[];
    latitude: number | null;
    longitude: number | null;
    experienceLevel: string | null;
    radiusKm: number;
    interests: { category: string; value: string }[];
}

// Weights — must sum to 1.0
const WEIGHTS = {
    skill: 0.35,
    location: 0.20,
    experience: 0.15,
    reputation: 0.15,
    availability: 0.10,
    interest: 0.05,
};

const EXPERIENCE_ORDER: Record<string, number> = {
    STUDENT: 1,
    JUNIOR: 2,
    MID: 3,
    SENIOR: 4,
    EXPERT: 5,
};

// Haversine formula — distance between two lat/lng points in km
function distanceKm(
    lat1: number, lon1: number,
    lat2: number, lon2: number
): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Jaccard similarity: |A ∩ B| / |A ∪ B|
function jaccardSimilarity(setA: string[], setB: string[]): number {
    if (setA.length === 0 && setB.length === 0) return 0;
    const a = new Set(setA);
    const b = new Set(setB);
    const intersection = [...a].filter((x) => b.has(x)).length;
    const union = new Set([...a, ...b]).size;
    return intersection / union;
}

// Individual dimension scores (each returns 0.0 – 1.0)

function scoreSkills(
    requiredSkillIds: string[],
    candidateSkills: { skillId: string }[]
): number {
    const candidateSkillIds = candidateSkills.map((s) => s.skillId);
    return jaccardSimilarity(requiredSkillIds, candidateSkillIds);
}

function scoreLocation(
    requester: RequesterContext,
    candidate: CandidateProfile
): number {
    if (
        !requester.latitude || !requester.longitude ||
        !candidate.latitude || !candidate.longitude
    ) return 0.5; // neutral if no location data

    const dist = distanceKm(
        requester.latitude, requester.longitude,
        candidate.latitude, candidate.longitude
    );

    if (dist > requester.radiusKm) return 0;
    return 1 - dist / requester.radiusKm;
}

function scoreExperience(
    requesterLevel: string | null,
    candidateLevel: string | null
): number {
    if (!requesterLevel || !candidateLevel) return 0.5;
    const diff = Math.abs(
        (EXPERIENCE_ORDER[requesterLevel] || 3) -
        (EXPERIENCE_ORDER[candidateLevel] || 3)
    );
    return 1 - diff / 4; // max diff is 4 (STUDENT vs EXPERT)
}

function scoreReputation(reputationScore: number): number {
    // reputation is stored as 0–500 (100 per rating point × 5 max)
    return Math.min(reputationScore / 500, 1);
}

function scoreAvailability(status: string): number {
    if (status === 'AVAILABLE') return 1.0;
    if (status === 'AWAY') return 0.5;
    return 0.2; // BUSY
}

function scoreInterests(
    requesterInterests: { value: string }[],
    candidateInterests: { value: string }[]
): number {
    const a = requesterInterests.map((i) => i.value);
    const b = candidateInterests.map((i) => i.value);
    return jaccardSimilarity(a, b);
}

// Boost multipliers applied after base score
function getBoostMultiplier(candidate: CandidateProfile): number {
    let boost = 1.0;
    if (candidate.isPremium) boost *= 1.20;
    if (candidate.availability === 'AVAILABLE') boost *= 1.10;
    if (candidate.acceptedConnectionsCount >= 5) boost *= 1.05;
    return boost;
}

// Main scoring function
export function scoreCandidate(
    candidate: CandidateProfile,
    requester: RequesterContext
): number {
    const dimensions = {
        skill: scoreSkills(requester.requiredSkillIds, candidate.skills),
        location: scoreLocation(requester, candidate),
        experience: scoreExperience(requester.experienceLevel, candidate.experienceLevel),
        reputation: scoreReputation(candidate.reputationScore),
        availability: scoreAvailability(candidate.availability),
        interest: scoreInterests(requester.interests, candidate.interests),
    };

    const baseScore =
        dimensions.skill * WEIGHTS.skill +
        dimensions.location * WEIGHTS.location +
        dimensions.experience * WEIGHTS.experience +
        dimensions.reputation * WEIGHTS.reputation +
        dimensions.availability * WEIGHTS.availability +
        dimensions.interest * WEIGHTS.interest;

    const boost = getBoostMultiplier(candidate);
    const finalScore = Math.min(baseScore * boost, 1.0); // cap at 1.0

    return Math.round(finalScore * 100) / 100; // round to 2 decimal places
}