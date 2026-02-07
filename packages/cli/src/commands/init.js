import fs from 'fs';
import path from 'path';
import yargs from 'yargs';

const defaultConfig = {
  analyzers: {
    usage: {
      enabled: true,
      ignorePatterns: ['**/*.test.ts', '**/*.spec.ts'],
    },
    missing: {
      enabled: true,
    },
    upgradeRisk: {
      enabled: true,
      allowPrereleases: false,
    },
    abandonment: {
      enabled: true,
      riskThreshold: 60,
      daysSincePublishWarning: 730,
    },
    security: {
      enabled: true,
      severityThreshold: 'moderate',
    },
  },
  ignore: ['@types/*'],
  thresholds: {
    maxUnused: 0,
    maxAbandoned: 5,
    maxHighRiskUpgrades: 3,
  },
  ci: {
    failOn: ['unused', 'missing', 'critical-security'],
  },
};

export default async function init(args, log, error, exit) {
  try {
    const argv = yargs(args)
      .usage('Usage: depheal init [path]')
      .boolean('force')
      .describe('force', 'Overwrite existing config file')
      .help('help', 'Show this help message')
      .argv;

    const targetDir = argv._[0] ? path.resolve(argv._[0]) : process.cwd();
    const filePath = path.join(targetDir, '.dephealrc.json');

    if (fs.existsSync(filePath) && !argv.force) {
      throw new Error(`Config already exists at ${filePath}. Use --force to overwrite.`);
    }

    fs.writeFileSync(filePath, `${JSON.stringify(defaultConfig, null, 2)}\n`, 'utf8');
    log(`Created ${filePath}`);
    exit(0);
  } catch (err) {
    error(err);
    exit(1);
  }
}
