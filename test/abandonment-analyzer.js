require('should');

const proxyquire = require('proxyquire');

function makeIso(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

describe('abandonment analyzer', () => {
  it('should return only high-risk results by default', async () => {
    const { analyzeAbandonment } = proxyquire(
      '../packages/core/dist/analyzers/abandonment',
      {
        '../data-sources/npm': {
          fetchNpmMetadata: async (name) => {
            if (name === 'oldpkg') {
              return {
                time: { modified: makeIso(900) },
                repository: { url: 'https://github.com/a/b' },
              };
            }
            return {
              time: { modified: makeIso(30) },
              repository: { url: 'https://github.com/a/b' },
            };
          },
        },
        '../data-sources/github': {
          fetchGithubMetadata: async () => ({
            pushed_at: makeIso(800),
            open_issues_count: 1,
            archived: false,
            disabled: false,
          }),
        },
      },
    );

    const results = await analyzeAbandonment(['oldpkg', 'newpkg'], {
      riskThreshold: 60,
    });

    results.map((r) => r.package).should.deepEqual(['oldpkg']);
    results[0].riskScore.should.be.aboveOrEqual(60);
  });

  it('should return all results when includeAll is true', async () => {
    const { analyzeAbandonment } = proxyquire(
      '../packages/core/dist/analyzers/abandonment',
      {
        '../data-sources/npm': {
          fetchNpmMetadata: async (name) => ({
            time: { modified: name === 'oldpkg' ? makeIso(900) : makeIso(30) },
            repository: { url: 'https://github.com/a/b' },
          }),
        },
        '../data-sources/github': {
          fetchGithubMetadata: async () => ({
            pushed_at: makeIso(10),
            open_issues_count: 0,
            archived: false,
            disabled: false,
          }),
        },
      },
    );

    const results = await analyzeAbandonment(['oldpkg', 'newpkg'], {
      riskThreshold: 60,
      includeAll: true,
    });

    results.map((r) => r.package).sort().should.deepEqual(['newpkg', 'oldpkg']);
  });
});

