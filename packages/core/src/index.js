import depcheck from './depcheck';
import fs from 'fs';
import path from 'path';
import { analyzeUsage } from './analyzers/usage';
import { analyzeMissing } from './analyzers/missing';
import { analyzeUpgradeRisk } from './analyzers/upgrade-risk';
import { analyzeAbandonment } from './analyzers/abandonment';
import { analyzeSecurity } from './analyzers/security';

export { default as depcheck } from './depcheck';
export { analyzeUsage } from './analyzers/usage';
export { analyzeMissing } from './analyzers/missing';
export { analyzeUpgradeRisk } from './analyzers/upgrade-risk';
export { analyzeAbandonment } from './analyzers/abandonment';
export { analyzeSecurity } from './analyzers/security';

export default depcheck;

function mapUsage(result) {
  const used = Object.keys(result.using || {});
  return {
    used,
    unused: result.dependencies || [],
    devUnused: result.devDependencies || [],
  };
}

function mapMissing(result) {
  return {
    missing: Object.keys(result.missing || {}),
    suggestions: [],
    details: result.missing || {},
  };
}

export async function analyzeProject(projectPath, options = {}) {
  const only = options.only ? new Set(options.only) : null;
  const includeUsage = !only || only.has('usage');
  const includeMissing = !only || only.has('missing');
  const includeUpgradeRisk = !only || only.has('upgradeRisk');
  const includeAbandonment = !only || only.has('abandonment');
  const includeSecurity = !only || only.has('security');

  if (
    !includeUsage &&
    !includeMissing &&
    !includeUpgradeRisk &&
    !includeAbandonment &&
    !includeSecurity
  ) {
    return {
      usage: null,
      missing: null,
      upgradeRisk: [],
      abandonment: [],
      security: [],
      _raw: null,
    };
  }

  const pkgPath = path.join(projectPath, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const allDeclared = {
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {}),
  };

  const depcheckResult =
    includeUsage || includeMissing
      ? await depcheck(projectPath, {
          ...options,
          skipMissing: !includeMissing,
        })
      : null;

  return {
    usage: includeUsage && depcheckResult ? mapUsage(depcheckResult) : null,
    missing: includeMissing && depcheckResult ? mapMissing(depcheckResult) : null,
    upgradeRisk: includeUpgradeRisk
      ? await analyzeUpgradeRisk(
          allDeclared,
          (options.analyzers && options.analyzers.upgradeRisk) || {},
        )
      : [],
    abandonment: includeAbandonment
      ? await analyzeAbandonment(
          Object.keys(allDeclared),
          (options.analyzers && options.analyzers.abandonment) || {},
        )
      : [],
    security: includeSecurity
      ? await analyzeSecurity(allDeclared, options)
      : [],
    _raw: depcheckResult,
  };
}

depcheck.analyzeProject = analyzeProject;
depcheck.analyzeUsage = analyzeUsage;
depcheck.analyzeMissing = analyzeMissing;
depcheck.analyzeUpgradeRisk = analyzeUpgradeRisk;
depcheck.analyzeAbandonment = analyzeAbandonment;
depcheck.analyzeSecurity = analyzeSecurity;
depcheck.analyzers = {
  usage: analyzeUsage,
  missing: analyzeMissing,
  upgradeRisk: analyzeUpgradeRisk,
  abandonment: analyzeAbandonment,
  security: analyzeSecurity,
};
