require('should');

const proxyquire = require('proxyquire');

describe('security analyzer', () => {
  it('should filter issues below severity threshold', async () => {
    const { analyzeSecurity } = proxyquire(
      '../packages/core/dist/analyzers/security',
      {
        '../data-sources/advisories': {
          runNpmAudit: async () => ({ vulnerabilities: {} }),
          normalizeAuditToIssues: () => [
            { package: 'a', severity: 'low', advisory: 'x', recommendation: '' },
            { package: 'b', severity: 'high', advisory: 'y', recommendation: '' },
          ],
          filterIssuesBySeverity: (issues, threshold) => {
            // Use the real exported helper behavior shape.
            const rank = (s) =>
              ({ low: 1, moderate: 2, high: 3, critical: 4 }[s] || 0);
            const tr = rank(threshold);
            return issues.filter((i) => rank(i.severity) >= tr);
          },
        },
      },
    );

    const issues = await analyzeSecurity(
      { a: '1.0.0', b: '1.0.0' },
      { projectPath: '/tmp/project', severityThreshold: 'high' },
    );
    issues.map((i) => i.package).should.deepEqual(['b']);
  });

  it('should return empty when no projectPath is provided', async () => {
    const { analyzeSecurity } = require('../packages/core/dist/analyzers/security');
    const issues = await analyzeSecurity({ a: '1.0.0' }, {});
    issues.should.deepEqual([]);
  });
});

