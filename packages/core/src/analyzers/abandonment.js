import { fetchNpmMetadata } from '../data-sources/npm';
import { fetchGithubMetadata } from '../data-sources/github';

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function daysBetween(now, date) {
  if (!date) return null;
  const ms = now.getTime() - date.getTime();
  if (!Number.isFinite(ms)) return null;
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function getRepoUrlFromNpm(metadata) {
  if (!metadata) return null;
  const repo = metadata.repository;
  if (!repo) return null;
  if (typeof repo === 'string') return repo;
  if (typeof repo === 'object' && repo.url) return repo.url;
  return null;
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const max = Math.max(1, concurrency || 6);
  const results = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const i = cursor;
      cursor += 1;
      results[i] = await mapper(items[i], i);
    }
  }

  const workers = Array.from({ length: Math.min(max, items.length) }, () =>
    worker(),
  );
  await Promise.all(workers);
  return results;
}

function computeRiskScore(signals, npmMeta, now, cfg) {
  let score = 0;

  const daysSincePublish = signals.daysSincePublish;
  const daysSinceCommit = signals.daysSinceCommit;

  // Publish recency (npm)
  if (daysSincePublish === null) {
    score += 20;
  } else if (daysSincePublish >= (cfg.daysSincePublishWarning || 730)) {
    score += 40;
  } else if (daysSincePublish >= 365) {
    score += 20;
  }

  // Commit recency (GitHub)
  if (signals.lastCommit === null && signals.lastPublish !== null) {
    // Repo missing or unparsable repo URL.
    score += 10;
  } else if (daysSinceCommit === null) {
    score += 15;
  } else if (daysSinceCommit >= (cfg.daysSinceCommitWarning || 365)) {
    score += 30;
  } else if (daysSinceCommit >= 180) {
    score += 10;
  }

  // Repository health (GitHub)
  if (signals.archived) score += 30;
  if (signals.disabled) score += 30;
  if (typeof signals.openIssues === 'number' && signals.openIssues > 200) {
    score += 10;
  }

  // npm metadata signals
  if (npmMeta && npmMeta.deprecated) {
    score += 20;
  }

  // Penalize missing repo metadata when publish date is stale
  if (!signals.repoUrl && daysSincePublish !== null && daysSincePublish >= 365) {
    score += 10;
  }

  return clamp(score, 0, 100);
}

function recommendationFromScore(score, threshold) {
  if (score >= threshold) return 'replace';
  if (score >= Math.max(0, threshold - 20)) return 'monitor';
  return 'safe';
}

export async function analyzeAbandonment(dependencies, options = {}) {
  const deps = Array.isArray(dependencies) ? dependencies : [];
  const cfg = options || {};

  const riskThreshold = typeof cfg.riskThreshold === 'number' ? cfg.riskThreshold : 60;
  const includeAll = Boolean(cfg.includeAll);
  const maxConcurrency =
    typeof cfg.maxConcurrency === 'number' ? cfg.maxConcurrency : 6;

  const now = new Date();

  const risks = await mapWithConcurrency(deps, maxConcurrency, async (pkg) => {
    const npmMeta = await fetchNpmMetadata(pkg, cfg.npm);
    const lastPublish = parseDate(
      npmMeta && npmMeta.time ? npmMeta.time.modified : null,
    );
    const repoUrl = getRepoUrlFromNpm(npmMeta);
    const ghMeta = repoUrl ? await fetchGithubMetadata(repoUrl, cfg.github) : null;
    const lastCommit = parseDate(ghMeta ? ghMeta.pushed_at : null);

    const signals = {
      repoUrl,
      lastPublish,
      daysSincePublish: daysBetween(now, lastPublish),
      lastCommit,
      daysSinceCommit: daysBetween(now, lastCommit),
      openIssues: ghMeta ? ghMeta.open_issues_count : null,
      archived: ghMeta ? Boolean(ghMeta.archived) : false,
      disabled: ghMeta ? Boolean(ghMeta.disabled) : false,
      hasActiveContributors:
        lastCommit !== null ? daysBetween(now, lastCommit) <= 365 : false,
      hasSecurityAdvisories: false,
    };

    const riskScore = computeRiskScore(signals, npmMeta, now, cfg);

    return {
      package: pkg,
      riskScore,
      signals: {
        lastPublish: signals.lastPublish,
        daysSincePublish: signals.daysSincePublish,
        lastCommit: signals.lastCommit,
        daysSinceCommit: signals.daysSinceCommit,
        openIssues: signals.openIssues || 0,
        hasActiveContributors: signals.hasActiveContributors,
        hasSecurityAdvisories: signals.hasSecurityAdvisories,
      },
      recommendation: recommendationFromScore(riskScore, riskThreshold),
      alternatives: [],
    };
  });

  const filtered = includeAll
    ? risks
    : risks.filter((r) => r.riskScore >= riskThreshold);

  return filtered.sort((a, b) => b.riskScore - a.riskScore);
}

