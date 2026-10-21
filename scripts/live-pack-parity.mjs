// A matching school-source hash proves source identity, not the full deployed
// question bank, calendar, lineage or supplementary content.
export function sameDeployedStudyPack(expected, actual) {
  if(!expected || !actual || expected.delivery!=='verified' || actual.delivery!=='verified')return false;
  if(!expected.pack || !actual.pack || !expected.sourceLastCheckedAt)return false;
  return actual.sourceLastCheckedAt===expected.sourceLastCheckedAt &&
    actual.pack.sourceHash===expected.pack.sourceHash &&
    actual.pack.lunchMenuHash===expected.pack.lunchMenuHash &&
    JSON.stringify(actual)===JSON.stringify(expected);
}
