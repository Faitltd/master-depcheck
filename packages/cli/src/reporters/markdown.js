export default function renderMarkdown(report) {
  const lines = [];
  lines.push('# Dependency Health Report');
  lines.push('');
  lines.push(`Scanned: ${report.summary.total} dependencies`);
  lines.push('');

  if (report.usage) {
    lines.push('## Usage Analysis');
    lines.push(`Used: ${report.usage.used.length}`);
    lines.push(`Unused: ${report.usage.unused.length}`);
    report.usage.unused.forEach((dep) => lines.push(`- ${dep}`));
    lines.push(`Dev Unused: ${report.usage.devUnused.length}`);
    report.usage.devUnused.forEach((dep) => lines.push(`- ${dep}`));
    lines.push('');
  }

  lines.push('## Missing Dependencies');
  lines.push(`Missing: ${report.missing.length}`);
  report.missing.forEach((dep) => lines.push(`- ${dep}`));
  lines.push('');

  lines.push('## Upgrade Risk');
  lines.push(`High Risk: ${report.upgradeRisk.length}`);
  lines.push('');

  lines.push('## Abandonment Risk');
  lines.push(`High Risk: ${report.abandonment.length}`);
  lines.push('');

  lines.push('## Security');
  lines.push(`Issues: ${report.security.length}`);
  lines.push('');

  lines.push('## Summary');
  lines.push(`Healthy: ${report.summary.healthy}`);
  lines.push(`Issues: ${report.summary.issues}`);
  lines.push(`Critical: ${report.summary.critical}`);

  return lines.join('\n').trim();
}
