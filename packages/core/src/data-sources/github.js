import https from 'https';

function httpsGetJson(url, { timeoutMs, token } = {}) {
  return new Promise((resolve, reject) => {
    const headers = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'dependency-health',
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const req = https.get(url, { headers }, (res) => {
      if (!res || (res.statusCode && res.statusCode >= 400)) {
        const code = res ? res.statusCode : 'NO_RESPONSE';
        res && res.resume();
        reject(new Error(`GitHub request failed (${code}) for ${url}`));
        return;
      }

      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(timeoutMs || 5000, () => {
      req.destroy(new Error(`GitHub request timeout after ${timeoutMs}ms`));
    });
  });
}

function extractGithubSlug(input) {
  if (!input) return null;

  // Allow "owner/repo" directly.
  if (/^[^/\s]+\/[^/\s]+$/.test(String(input))) {
    const [owner, repo] = String(input).split('/');
    return { owner, repo };
  }

  let url = String(input).trim();
  url = url.replace(/^git\+/, '').replace(/\.git(#.*)?$/, '');

  // Support scp-style git URLs like "git@github.com:owner/repo.git"
  const scpMatch = url.match(/^git@github\.com:([^/]+)\/([^/]+)$/i);
  if (scpMatch) {
    return { owner: scpMatch[1], repo: scpMatch[2].replace(/\.git$/, '') };
  }

  try {
    const parsed = new URL(url);
    if (!/github\.com$/i.test(parsed.hostname)) return null;
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return null;
    return { owner: parts[0], repo: parts[1] };
  } catch (err) {
    return null;
  }
}

const cache = new Map();

export async function fetchGithubMetadata(repoUrlOrSlug, options = {}) {
  const slug = extractGithubSlug(repoUrlOrSlug);
  if (!slug) return null;

  const token =
    options.token || process.env.GITHUB_TOKEN || process.env.GH_TOKEN || null;
  const timeoutMs = options.timeoutMs || 5000;
  const cacheKey = `${slug.owner}/${slug.repo}::${Boolean(token)}`;

  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const promise = (async () => {
    const url = `https://api.github.com/repos/${encodeURIComponent(
      slug.owner,
    )}/${encodeURIComponent(slug.repo)}`;
    try {
      return await httpsGetJson(url, { timeoutMs, token });
    } catch (err) {
      return null;
    }
  })();

  cache.set(cacheKey, promise);
  return promise;
}

export function _clearGithubMetadataCacheForTests() {
  cache.clear();
}
