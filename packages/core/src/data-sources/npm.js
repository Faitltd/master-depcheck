import https from 'https';

function getDefaultRegistryUrl() {
  // npm config supports both of these env vars depending on invocation context.
  const fromEnv =
    process.env.npm_config_registry || process.env.NPM_CONFIG_REGISTRY;
  return (fromEnv || 'https://registry.npmjs.org').replace(/\/+$/, '');
}

function httpsGetJson(url, { timeoutMs, headers } = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'dependency-health',
          ...(headers || {}),
        },
      },
      (res) => {
        if (!res || (res.statusCode && res.statusCode >= 400)) {
          const code = res ? res.statusCode : 'NO_RESPONSE';
          res && res.resume();
          reject(new Error(`npm registry request failed (${code}) for ${url}`));
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
      },
    );

    req.on('error', reject);
    req.setTimeout(timeoutMs || 5000, () => {
      req.destroy(new Error(`npm registry request timeout after ${timeoutMs}ms`));
    });
  });
}

const cache = new Map();

function encodePackageName(packageName) {
  return packageName
    .split('/')
    .map((s) => encodeURIComponent(s))
    .join('/');
}

async function fetchLatestManifest(packageName, { registryUrl, timeoutMs } = {}) {
  const encoded = encodePackageName(packageName);
  const url = `${registryUrl}/${encoded}/latest`;
  return httpsGetJson(url, { timeoutMs });
}

async function fetchSearchResult(packageName, { registryUrl, timeoutMs } = {}) {
  // Use npm search API for publish date and links without downloading full packuments.
  const url = `${registryUrl}/-/v1/search?text=${encodeURIComponent(
    packageName,
  )}&size=20`;
  return httpsGetJson(url, { timeoutMs });
}

export async function fetchNpmMetadata(packageName, options = {}) {
  if (!packageName) return null;

  const registryUrl = (options.registryUrl || getDefaultRegistryUrl()).replace(
    /\/+$/,
    '',
  );
  const timeoutMs = options.timeoutMs || 5000;
  const cacheKey = `${registryUrl}::${packageName}`;

  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const promise = (async () => {
    try {
      const [latest, search] = await Promise.all([
        fetchLatestManifest(packageName, { registryUrl, timeoutMs }),
        fetchSearchResult(packageName, { registryUrl, timeoutMs }).catch(
          () => null,
        ),
      ]);

      const match =
        search && Array.isArray(search.objects)
          ? search.objects.find(
              (o) => o && o.package && o.package.name === packageName,
            )
          : null;

      // Shape it like the old packument-derived data we were using.
      const modified = match && match.package && match.package.date
        ? match.package.date
        : null;

      return {
        'dist-tags': {
          latest: latest && latest.version ? String(latest.version) : null,
        },
        deprecated: latest && latest.deprecated ? latest.deprecated : null,
        repository: latest && latest.repository ? latest.repository : null,
        time: modified ? { modified } : null,
      };
    } catch (err) {
      return null;
    }
  })();

  cache.set(cacheKey, promise);
  return promise;
}

export function _clearNpmMetadataCacheForTests() {
  cache.clear();
}
