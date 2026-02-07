import semver from 'semver';
import { fetchNpmMetadata } from '../data-sources/npm';

function isPrerelease(version) {
  try {
    return Boolean(semver.prerelease(version));
  } catch (err) {
    return false;
  }
}

function normalizeCurrentVersion(versionRange) {
  if (!versionRange) return null;
  const direct = semver.valid(versionRange);
  if (direct) return direct;
  const min = semver.minVersion(versionRange);
  return min ? min.version : null;
}

function levelRank(level) {
  switch (level) {
    case 'breaking':
      return 4;
    case 'major':
      return 3;
    case 'minor':
      return 2;
    case 'safe':
      return 1;
    default:
      return 0;
  }
}

function compareLevel(a, b) {
  return levelRank(b.riskLevel) - levelRank(a.riskLevel);
}

function computeRiskLevel(current, latest) {
  if (!current || !latest) return { riskLevel: 'safe', reasons: [] };

  const reasons = [];
  const currentMajor = semver.major(current);
  const currentMinor = semver.minor(current);
  const latestMajor = semver.major(latest);
  const latestMinor = semver.minor(latest);

  // Pre-1.0 minor bumps can be breaking.
  if (currentMajor === 0 && latestMajor === 0 && currentMinor !== latestMinor) {
    reasons.push('pre-1.0 minor bump may be breaking');
    return { riskLevel: 'breaking', reasons };
  }

  const diff = semver.diff(current, latest);
  if (diff === 'major' || diff === 'premajor') {
    return { riskLevel: 'major', reasons };
  }
  if (diff === 'minor' || diff === 'preminor') {
    return { riskLevel: 'minor', reasons };
  }

  return { riskLevel: 'safe', reasons };
}

export async function analyzeUpgradeRisk(dependencies, options = {}) {
  const deps = dependencies || {};
  const allowPrereleases = Boolean(options.allowPrereleases);

  const results = await Promise.all(
    Object.entries(deps).map(async ([pkg, range]) => {
      const currentNormalized = normalizeCurrentVersion(range);
      const metadata = await fetchNpmMetadata(pkg, options.npm);
      const latest =
        metadata && metadata['dist-tags'] && metadata['dist-tags'].latest
          ? String(metadata['dist-tags'].latest)
          : null;

      const reasons = [];
      if (metadata && metadata.deprecated) {
        reasons.push('deprecated on npm');
      }

      if (latest && !allowPrereleases && isPrerelease(latest)) {
        reasons.push('latest is a prerelease (ignored by policy)');
        return {
          package: pkg,
          current: String(range || ''),
          latest,
          riskLevel: 'safe',
          reasons,
        };
      }

      const currentSemver = currentNormalized && semver.valid(currentNormalized)
        ? currentNormalized
        : null;
      const latestSemver = latest && semver.valid(latest) ? latest : null;

      const scored =
        currentSemver && latestSemver
          ? computeRiskLevel(currentSemver, latestSemver)
          : { riskLevel: 'safe', reasons: [] };

      return {
        package: pkg,
        current: String(range || ''),
        latest,
        riskLevel: scored.riskLevel,
        reasons: reasons.concat(scored.reasons),
      };
    }),
  );

  // Return only packages that are deprecated or have a non-patch upgrade risk.
  return results
    .filter((r) => {
      const current = normalizeCurrentVersion(r.current) || null;
      return Boolean(r.latest && (!current || r.latest !== current));
    })
    .filter((r) => r.riskLevel !== 'safe' || (r.reasons && r.reasons.length))
    .sort(compareLevel);
}

