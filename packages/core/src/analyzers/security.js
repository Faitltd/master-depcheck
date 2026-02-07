import {
  runNpmAudit,
  normalizeAuditToIssues,
  filterIssuesBySeverity,
} from '../data-sources/advisories';

export async function analyzeSecurity(_dependencies, options = {}) {
  const projectPath = options.projectPath;
  const cfg = options || {};

  if (!projectPath) return [];

  const auditJson = await runNpmAudit(projectPath, cfg.npmAudit || {});
  const issues = normalizeAuditToIssues(auditJson);
  return filterIssuesBySeverity(issues, cfg.severityThreshold);
}

