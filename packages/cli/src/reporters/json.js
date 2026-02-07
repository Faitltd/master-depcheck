export default function renderJson(report) {
  const output = {
    timestamp: report.timestamp,
    project: report.project,
    summary: report.summary,
    usage: report.usage ? {
      used: report.usage.used,
      unused: report.usage.unused,
      devUnused: report.usage.devUnused,
    } : null,
    missing: report.missing || [],
    upgradeRisk: report.upgradeRisk || [],
    abandonment: report.abandonment || [],
    security: report.security || [],
  };

  if (report.using) {
    output.using = report.using;
  }
  if (report.usage) {
    output.dependencies = report.usage.unused;
    output.devDependencies = report.usage.devUnused;
  }
  if (report.invalidFiles) {
    output.invalidFiles = report.invalidFiles;
  }
  if (report.invalidDirs) {
    output.invalidDirs = report.invalidDirs;
  }
  if (report.missingDetails) {
    output.missingDetails = report.missingDetails;
  }

  return JSON.stringify(
    output,
    (key, value) => (value instanceof Error ? value.stack : value),
    2,
  );
}
