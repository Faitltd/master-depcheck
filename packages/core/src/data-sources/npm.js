import https from 'https';

function getDefaultRegistryUrl() {
  // npm config supports both of these env vars depending on invocation context.
  const fromEnv =
    process.env.npm_config_registry || process.env.NPM_CONFIG_REGISTRY;
  return (fromEnv || 'https://registry.npmjs.org').replace(/\/+$/, '');
}

function httpsGetJson(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          Accept: 'application/vnd.npm.install-v1+json',
          'User-Agent': 'dependency-health',
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
    const encoded = packageName
      .split('/')
      .map((s) => encodeURIComponent(s))
      .join('/');
    const url = `${registryUrl}/${encoded}`;
    try {
      return await httpsGetJson(url, timeoutMs);
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

