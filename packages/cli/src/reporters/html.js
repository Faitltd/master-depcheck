function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function list(items) {
  if (!items || items.length === 0) {
    return '<p>None</p>';
  }
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}

export default function renderHtml(report) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Dependency Health Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #1a1a1a; }
    h1 { margin-bottom: 4px; }
    h2 { margin-top: 24px; }
  </style>
</head>
<body>
  <h1>Dependency Health Report</h1>
  <p>Scanned: ${report.summary.total} dependencies</p>

  <h2>Usage Analysis</h2>
  ${report.usage ? `
    <p>Used: ${report.usage.used.length}</p>
    <p>Unused: ${report.usage.unused.length}</p>
    ${list(report.usage.unused)}
    <p>Dev Unused: ${report.usage.devUnused.length}</p>
    ${list(report.usage.devUnused)}
  ` : '<p>Skipped</p>'}

  <h2>Missing Dependencies</h2>
  <p>Missing: ${report.missing.length}</p>
  ${list(report.missing)}

  <h2>Upgrade Risk</h2>
  <p>High Risk: ${report.upgradeRisk.length}</p>

  <h2>Abandonment Risk</h2>
  <p>High Risk: ${report.abandonment.length}</p>

  <h2>Security</h2>
  <p>Issues: ${report.security.length}</p>

  <h2>Summary</h2>
  <p>Healthy: ${report.summary.healthy}</p>
  <p>Issues: ${report.summary.issues}</p>
  <p>Critical: ${report.summary.critical}</p>
</body>
</html>`;
}
