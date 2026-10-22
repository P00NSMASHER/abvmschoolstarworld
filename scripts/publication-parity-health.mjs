// Live publication evidence is separate from a successful workflow or fresh source scan.
// A missing response cannot be counted as a successful Pages publication.
export function assessPublicationParity(plan) {
  const state = value => value === true ? 'verified' : value === false ? 'mismatch' : 'unknown';
  const curriculum = state(plan?.curriculumLiveMatches);
  const homework = state(plan?.homeworkLiveMatches);
  const overall = curriculum === 'mismatch' || homework === 'mismatch'
    ? 'mismatch'
    : curriculum === 'verified' && homework === 'verified' ? 'verified' : 'unknown';
  return {
    state: overall,
    verified: overall === 'verified',
    curriculum,
    homework,
    checkedAt: {
      curriculum: typeof plan?.checkedAt?.curriculum === 'string' ? plan.checkedAt.curriculum : null,
      homework: typeof plan?.checkedAt?.homework === 'string' ? plan.checkedAt.homework : null,
    },
    caution: Array.isArray(plan?.caution) ? plan.caution.map(String) : [],
  };
}
