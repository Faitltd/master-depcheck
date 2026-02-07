import path from 'path';

function formatMissingDetails(missingDetails, rootDir) {
  return Object.entries(missingDetails).map(([dep, files]) => {
    if (!files || files.length === 0) return dep;
    const first = files[0];
    const display = rootDir ? path.relative(rootDir, first) : first;
    return `${dep} (${display})`;
  });
}

export default function renderConsole(report, opt = {}) {
  if (opt.quiet && report.summary.issues === 0) {
    return '';
  }

  const lines = [];

  lines.push('Dependency Health Report');
  lines.push(`Scanned: ${report.summary.total} dependencies`);
  lines.push('');

  if (report.usage) {
    lines.push('Usage Analysis');
    lines.push(`Used: ${report.usage.used.length} packages`);
    lines.push(`Unused: ${report.usage.unused.length} packages`);
    report.usage.unused.forEach((dep) => lines.push(`- ${dep}`));
    lines.push(`Dev Unused: ${report.usage.devUnused.length} packages`);
    report.usage.devUnused.forEach((dep) => lines.push(`- ${dep}`));
    lines.push('');
  }

  if (report.missing) {
    lines.push('Missing Dependencies');
    lines.push(`Missing: ${report.missing.length} packages`);
    const detailList = formatMissingDetails(
      report.missingDetails || {},
      report.project,
    );
    detailList.forEach((dep) => lines.push(`- ${dep}`));
    lines.push('');
  }

  if (Array.isArray(report.upgradeRisk)) {
    lines.push('Upgrade Risk');
    lines.push(`High Risk: ${report.upgradeRisk.length} packages`);
    lines.push('');
  }

  if (Array.isArray(report.abandonment)) {
    lines.push('Abandonment Risk');
    lines.push(`High Risk: ${report.abandonment.length} packages`);
    lines.push('');
  }

  if (Array.isArray(report.security)) {
    lines.push('Security');
    lines.push(`Issues: ${report.security.length}`);
    lines.push('');
  }

  lines.push('Summary');
  lines.push(`Healthy: ${report.summary.healthy}`);
  lines.push(`Issues: ${report.summary.issues}`);
  lines.push(`Critical: ${report.summary.critical}`);

  return lines.join('\n').trim();
}
