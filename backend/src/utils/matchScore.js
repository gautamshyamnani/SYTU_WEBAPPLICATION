/**
 * matchScore — calculates a relevance score between the current user
 * and a candidate user.
 *
 * Scoring rules (tunable constants at the top):
 *   +10 per overlapping skill (case-insensitive)
 *   +5  if location matches (case-insensitive, trimmed)
 *   +5  if candidate's profile is marked complete
 *
 * Returns an integer >= 0.
 */

const POINTS = {
  PER_SKILL: 10,
  SAME_LOCATION: 5,
  PROFILE_COMPLETE: 5,
};

/**
 * @param {Object} currentUser  - the logged-in user doc
 * @param {Object} candidate    - a plain object from the aggregation pipeline
 * @returns {number}
 */
const computeMatchScore = (currentUser, candidate) => {
  let score = 0;

  // ── Skill overlap ──────────────────────────────────────────────────────────
  const mySkills = normaliseSkills(currentUser.skills);
  const theirSkills = normaliseSkills(candidate.skills);

  if (mySkills.size > 0 && theirSkills.size > 0) {
    for (const skill of theirSkills) {
      if (mySkills.has(skill)) score += POINTS.PER_SKILL;
    }
  }

  // ── Location match ─────────────────────────────────────────────────────────
  const myLoc = (currentUser.location || '').trim().toLowerCase();
  const theirLoc = (candidate.location || '').trim().toLowerCase();
  if (myLoc && theirLoc && myLoc === theirLoc) {
    score += POINTS.SAME_LOCATION;
  }

  // ── Profile completeness ───────────────────────────────────────────────────
  if (candidate.isProfileComplete) {
    score += POINTS.PROFILE_COMPLETE;
  }

  return score;
};

/** Returns a Set of lowercased, trimmed skill strings */
const normaliseSkills = (skills) => {
  if (!Array.isArray(skills)) return new Set();
  return new Set(skills.map((s) => String(s).trim().toLowerCase()).filter(Boolean));
};

module.exports = { computeMatchScore };
