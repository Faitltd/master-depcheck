import fs from 'fs';
import path from 'path';
import lodash from 'lodash';

import depcheck from '@fait/dependency-health-core';
import { version } from '../../package.json';
import { getConfiguration } from '../utils/configuration-reader.js';
import renderConsole from '../reporters/console.js';
import renderJson from '../reporters/json.js';
import renderMarkdown from '../reporters/markdown.js';
import renderHtml from '../reporters/html.js';

const ANALYZER_ALIASES = new Map([
  ['usage', 'usage'],
  ['missing', 'missing'],
  ['upgrade', 'upgradeRisk'],
  ['upgradeRisk', 'upgradeRisk'],
  ['upgrade-risk', 'upgradeRisk'],
  ['abandonment', 'abandonment'],
  ['security', 'security'],
]);

const ALL_ANALYZERS = [
  'usage',
  'missing',
  'upgradeRisk',
  'abandonment',
  'security',
];

function checkPathExist(dir, errorMessage) {
  return new Promise((resolve, reject) =>
    fs.exists(dir, (result) => (result ? resolve() : reject(errorMessage))),
  );
}

function normalizeAnalyzerList(input) {
  if (!input) return [];
  const list = Array.isArray(input) ? input : [input];
  return list
    .filter(Boolean)
    .flatMap((value) => String(value).split(','))
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => ANALYZER_ALIASES.get(value) || value)
    .filter((value) => ALL_ANALYZERS.includes(value));
}

function resolveEnabledAnalyzers(opt) {
  const only = normalizeAnalyzerList(opt.only);
  if (only.length) {
    return only;
  }

  // Default behavior: stay offline/fast and keep backwards-compatible behavior
  // by running only the depcheck-derived analyzers.
  const enabled = new Set(['usage', 'missing']);

  const analyzers = opt.analyzers && typeof opt.analyzers === 'object'
    ? opt.analyzers
    : null;
  if (!analyzers) return Array.from(enabled);

  Object.entries(analyzers).forEach(([key, value]) => {
    const canonical = ANALYZER_ALIASES.get(key) || key;
    if (!ALL_ANALYZERS.includes(canonical)) return;

    if (value && value.enabled === true) {
      enabled.add(canonical);
    } else if (value && value.enabled === false) {
      enabled.delete(canonical);
    }
  });

  return Array.from(enabled);
}

function getParsers(parsers) {
  if (!parsers) {
    return undefined;
  }

  const parserTuples = Object.entries(parsers).map(
    ([extension, parserNames]) => {
      const sanitizedParserNames = Array.isArray(parserNames)
        ? parserNames
        : [parserNames];
      const parserLambdas = sanitizedParserNames.map(
        (parserName) => depcheck.parser[parserName],
      );
      return [extension, parserLambdas];
    },
  );

  return lodash.fromPairs(parserTuples);
}

function getDetectors(detectors) {
  return lodash.isUndefined(detectors)
    ? undefined
    : detectors.map((detectorName) => depcheck.detector[detectorName]);
}

function getSpecials(specials) {
  return lodash.isUndefined(specials)
    ? undefined
    : specials.map((specialName) => depcheck.special[specialName]);
}

function normalizeIgnoreList(opt) {
  const ignores = [];
  if (Array.isArray(opt.ignore)) {
    ignores.push(...opt.ignore);
  } else if (typeof opt.ignore === 'string') {
    ignores.push(...opt.ignore.split(','));
  }
  if (Array.isArray(opt.ignores)) {
    ignores.push(...opt.ignores);
  } else if (typeof opt.ignores === 'string') {
    ignores.push(...opt.ignores.split(','));
  }
  if (Array.isArray(opt.ignoreMatches)) {
    ignores.push(...opt.ignoreMatches);
  } else if (typeof opt.ignoreMatches === 'string') {
    ignores.push(...opt.ignoreMatches.split(','));
  }
  return lodash.uniq(ignores.filter(Boolean));
}

function normalizeIgnorePatterns(opt) {
  const patterns = [];
  if (Array.isArray(opt.ignorePatterns)) {
    patterns.push(...opt.ignorePatterns);
  } else if (typeof opt.ignorePatterns === 'string') {
    patterns.push(...opt.ignorePatterns.split(','));
  }
  if (Array.isArray(opt.ignoreDirs)) {
    patterns.push(...opt.ignoreDirs);
  } else if (typeof opt.ignoreDirs === 'string') {
    patterns.push(...opt.ignoreDirs.split(','));
  }
  if (opt.analyzers && opt.analyzers.usage) {
    const analyzerPatterns = opt.analyzers.usage.ignorePatterns;
    if (Array.isArray(analyzerPatterns)) {
      patterns.push(...analyzerPatterns);
    }
  }
  return patterns;
}

function buildSummary({ usage, missing, upgradeRisk, abandonment, security }, pkg) {
  const declaredDeps = Object.keys(pkg.dependencies || {});
  const declaredDevDeps = Object.keys(pkg.devDependencies || {});
  const total = declaredDeps.length + declaredDevDeps.length;

  const unusedCount = usage
    ? usage.unused.length + usage.devUnused.length
    : 0;
  const missingCount = missing ? missing.missing.length : 0;
  const upgradeCount = upgradeRisk ? upgradeRisk.length : 0;
  const abandonmentCount = abandonment ? abandonment.length : 0;
  const securityCount = security ? security.length : 0;
  const criticalCount = security
    ? security.filter((issue) => issue.severity === 'critical').length
    : 0;

  return {
    total,
    healthy: Math.max(0, total - unusedCount),
    issues:
      unusedCount + missingCount + upgradeCount + abandonmentCount + securityCount,
    critical: criticalCount,
  };
}

function shouldFailCi({ usage, missing, upgradeRisk, abandonment, security }, opt) {
  const ciConfig = typeof opt.ci === 'object' && opt.ci ? opt.ci : null;
  const ciEnabled = opt.ci === true || Boolean(ciConfig);
  if (!ciEnabled) return false;

  const failOn = ciConfig && Array.isArray(ciConfig.failOn)
    ? ciConfig.failOn
    : null;

  const thresholds = opt.thresholds && typeof opt.thresholds === 'object'
    ? opt.thresholds
    : {};

  const unusedCount = usage
    ? usage.unused.length + usage.devUnused.length
    : 0;
  const missingCount = missing ? missing.missing.length : 0;
  const highRiskUpgradeCount = upgradeRisk
    ? upgradeRisk.filter((u) => u && (u.riskLevel === 'major' || u.riskLevel === 'breaking'))
        .length
    : 0;
  const abandonmentThreshold =
    opt.analyzers &&
    opt.analyzers.abandonment &&
    typeof opt.analyzers.abandonment.riskThreshold === 'number'
      ? opt.analyzers.abandonment.riskThreshold
      : 60;
  const highRiskAbandonmentCount = abandonment
    ? abandonment.filter((r) => r && typeof r.riskScore === 'number' && r.riskScore >= abandonmentThreshold)
        .length
    : 0;
  const securityCount = security ? security.length : 0;
  const criticalCount = security
    ? security.filter((issue) => issue.severity === 'critical').length
    : 0;

  const allowedUnused =
    typeof thresholds.maxUnused === 'number' ? thresholds.maxUnused : 0;
  const allowedMissing =
    typeof thresholds.maxMissing === 'number' ? thresholds.maxMissing : 0;
  const allowedHighRiskUpgrades =
    typeof thresholds.maxHighRiskUpgrades === 'number'
      ? thresholds.maxHighRiskUpgrades
      : 0;
  const allowedAbandoned =
    typeof thresholds.maxAbandoned === 'number' ? thresholds.maxAbandoned : 0;
  const allowedSecurity =
    typeof thresholds.maxSecurity === 'number' ? thresholds.maxSecurity : 0;
  const allowedCriticalSecurity =
    typeof thresholds.maxCriticalSecurity === 'number'
      ? thresholds.maxCriticalSecurity
      : 0;

  if (!failOn) {
    return (
      unusedCount > allowedUnused ||
      missingCount > allowedMissing ||
      highRiskUpgradeCount > allowedHighRiskUpgrades ||
      highRiskAbandonmentCount > allowedAbandoned ||
      securityCount > allowedSecurity ||
      criticalCount > allowedCriticalSecurity
    );
  }

  const failOnSet = new Set(failOn);
  if (failOnSet.has('unused') && unusedCount > allowedUnused) return true;
  if (failOnSet.has('missing') && missingCount > allowedMissing) return true;
  if (failOnSet.has('upgrade') && highRiskUpgradeCount > allowedHighRiskUpgrades) return true;
  if (failOnSet.has('abandoned') && highRiskAbandonmentCount > allowedAbandoned) return true;
  if (failOnSet.has('security') && securityCount > allowedSecurity) return true;
  if (failOnSet.has('critical-security') && criticalCount > allowedCriticalSecurity) return true;

  return false;
}

export default async function scan(args, log, error, exit) {
  try {
    const opt = await getConfiguration(args, 'depheal', version);
    const dir = opt._[0] || '.';
    const rootDir = path.resolve(dir);

    await checkPathExist(rootDir, `Path ${dir} does not exist`);
    await checkPathExist(
      path.resolve(rootDir, 'package.json'),
      `Path ${dir} does not contain a package.json file`,
    );

    const enabledAnalyzers = resolveEnabledAnalyzers(opt).filter(
      (analyzer) => !(opt.skipMissing && analyzer === 'missing'),
    );
    const ignoreMatches = normalizeIgnoreList(opt);
    const ignorePatterns = normalizeIgnorePatterns(opt);

    const analysis = await depcheck.analyzeProject(rootDir, {
      ignoreBinPackage: opt.ignoreBinPackage,
      ignorePath: opt.ignorePath,
      ignoreMatches,
      ignoreDirs: opt.ignoreDirs || [],
      ignorePatterns,
      analyzers: opt.analyzers,
      parsers: getParsers(opt.parsers),
      detectors: getDetectors(opt.detectors),
      specials: getSpecials(opt.specials),
      skipMissing: opt.skipMissing,
      only: enabledAnalyzers,
    });

    const packageJson = JSON.parse(
      fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'),
    );

    const raw = analysis._raw || {};
    const report = {
      timestamp: new Date().toISOString(),
      project: rootDir,
      summary: buildSummary(analysis, packageJson),
      usage: analysis.usage,
      missing: analysis.missing ? analysis.missing.missing : [],
      missingDetails: analysis.missing ? analysis.missing.details : {},
      upgradeRisk: analysis.upgradeRisk || [],
      abandonment: analysis.abandonment || [],
      security: analysis.security || [],
      using: raw.using || {},
      invalidFiles: raw.invalidFiles || {},
      invalidDirs: raw.invalidDirs || {},
    };

    const format = opt.format || (opt.json ? 'json' : 'console');
    const output = opt.output;

    let rendered = '';
    switch (format) {
      case 'json':
        rendered = renderJson(report);
        break;
      case 'markdown':
        rendered = renderMarkdown(report);
        break;
      case 'html':
        rendered = renderHtml(report);
        break;
      case 'console':
      default:
        rendered = renderConsole(report, opt);
        break;
    }

    if (output) {
      fs.writeFileSync(output, rendered, 'utf8');
    } else if (!opt.quiet || report.summary.issues > 0) {
      log(rendered);
    }

    exit(shouldFailCi(analysis, opt) ? 1 : 0);
  } catch (err) {
    error(err);
    exit(1);
  }
}
