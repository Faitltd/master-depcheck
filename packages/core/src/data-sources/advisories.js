import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';

function execFilePromise(cmd, args, options) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, options, (err, stdout, stderr) => {
      if (err) {
        // npm audit returns non-zero exit codes when vulnerabilities are found,
        // but still prints valid JSON on stdout.
        err.stdout = stdout;
        err.stderr = stderr;
        reject(err);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

function hasLockfile(projectPath) {
  const candidates = ['package-lock.json', 'npm-shrinkwrap.json'];
  return candidates.some((f) => fs.existsSync(path.join(projectPath, f)));
}

export async function runNpmAudit(projectPath, options = {}) {
  if (!projectPath) return null;
  if (!hasLockfile(projectPath)) return null;

  const timeoutMs = options.timeoutMs || 60_000;

  const args = ['audit', '--json'];
  if (options.omitDev === true) {
    // npm >= 8 supports omit=dev to ignore dev deps in the audit.
    args.push('--omit=dev');
  }

  try {
    const { stdout } = await execFilePromise('npm', args, {
      cwd: projectPath,
      timeout: timeoutMs,
      maxBuffer: 20 * 1024 * 1024,
    });
    return JSON.parse(stdout);
  } catch (err) {
    const out = err && err.stdout ? String(err.stdout) : '';
    try {
      return out ? JSON.parse(out) : null;
    } catch (parseErr) {
      return null;
    }
  }
}

function severityRank(sev) {
  switch (sev) {
    case 'critical':
      return 4;
    case 'high':
      return 3;
    case 'moderate':
      return 2;
    case 'low':
      return 1;
    default:
      return 0;
  }
}

function maxSeverity(severities) {
  return severities.reduce((acc, s) => (severityRank(s) > severityRank(acc) ? s : acc), 'low');
}

export function normalizeAuditToIssues(auditJson) {
  if (!auditJson) return [];

  // npm v6 format: { advisories: { id: { module_name, severity, title, url, cves, patched_versions } } }
  if (auditJson.advisories) {
    const byPkg = new Map();
    Object.values(auditJson.advisories).forEach((adv) => {
      if (!adv || !adv.module_name) return;
      const pkg = adv.module_name;
      const existing = byPkg.get(pkg) || {
        package: pkg,
        severity: adv.severity || 'low',
        advisory: '',
        cve: undefined,
        patchedIn: adv.patched_versions || undefined,
        recommendation: '',
        _titles: [],
        _cves: [],
        _urls: [],
      };
      existing._titles.push(adv.title || '');
      if (Array.isArray(adv.cves)) existing._cves.push(...adv.cves);
      if (adv.url) existing._urls.push(adv.url);
      existing.severity = maxSeverity([existing.severity, adv.severity || 'low']);
      if (adv.patched_versions) existing.patchedIn = adv.patched_versions;
      byPkg.set(pkg, existing);
    });

    return Array.from(byPkg.values()).map((v) => ({
      package: v.package,
      severity: v.severity,
      advisory: v._titles.filter(Boolean).join('; ') || v._urls[0] || 'npm advisory',
      cve: v._cves[0],
      patchedIn: v.patchedIn,
      recommendation: v.patchedIn
        ? `Upgrade to a version matching: ${v.patchedIn}`
        : 'Review npm audit output for remediation',
    }));
  }

  // npm v7+ format: { vulnerabilities: { pkg: { name, severity, via: [...], fixAvailable } } }
  if (auditJson.vulnerabilities) {
    return Object.values(auditJson.vulnerabilities)
      .filter(Boolean)
      .map((vuln) => {
        const viaObjs = Array.isArray(vuln.via)
          ? vuln.via.filter((x) => x && typeof x === 'object')
          : [];
        const titles = viaObjs.map((x) => x.title).filter(Boolean);
        const urls = viaObjs.map((x) => x.url).filter(Boolean);
        const cves = viaObjs
          .flatMap((x) => (Array.isArray(x.cves) ? x.cves : []))
          .filter(Boolean);

        let recommendation = 'Review npm audit output for remediation';
        if (vuln.fixAvailable === true) {
          recommendation = 'Run npm audit fix';
        } else if (vuln.fixAvailable && typeof vuln.fixAvailable === 'object') {
          const name = vuln.fixAvailable.name || vuln.name;
          const version = vuln.fixAvailable.version;
          recommendation = version
            ? `Upgrade ${name} to ${version}`
            : `Upgrade ${name}`;
        }

        return {
          package: vuln.name,
          severity: vuln.severity || 'low',
          advisory: titles.join('; ') || urls[0] || 'npm audit vulnerability',
          cve: cves[0],
          patchedIn: undefined,
          recommendation,
        };
      })
      .filter((issue) => severityRank(issue.severity) > 0);
  }

  return [];
}

export function filterIssuesBySeverity(issues, severityThreshold) {
  if (!severityThreshold) return issues;
  const thresholdRank = severityRank(severityThreshold);
  return issues.filter((i) => severityRank(i.severity) >= thresholdRank);
}

