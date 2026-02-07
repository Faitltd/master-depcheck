# Dependency Health – Combined Tool Design

Complete design for a unified tool that combines the best of depcheck, dependency-check, dependency-checker, and abandoned into one dependency analysis CLI/service.

## Repos We Learn From

1. depcheck (archived)
   - Repo: https://github.com/depcheck/depcheck
   - What we take:
     - Core logic for detecting unused and missing dependencies by parsing code for imports/requires.
     - Detection patterns for different module systems (CommonJS, ESM, dynamic imports).
     - Parser approach for various file types (JS, TS, JSX, TSX).

2. dependency-check
   - Repo: https://github.com/dependency-check-team/dependency-check
   - What we take:
     - Focus on missing dependencies (what's used but not declared).
     - Exit-code patterns for CI integration (non-zero when issues found).
     - CLI design for --missing and --unused flags.

3. dependency-checker
   - Repo: https://github.com/KittyGiraudel/dependency-checker
   - What we take:
     - Logic for checking upgrade safety (major version bumps, pre-1.0 packages).
     - Comparison of package.json versions vs latest npm versions.
     - Concept of unsafe updates scoring.

4. abandoned
   - Repo: https://github.com/brendonboshell/abandoned
   - npm: https://www.npmjs.com/package/abandoned
   - What we take:
     - Concept of abandonware detection (packages with no recent releases).
     - Age-based risk scoring.

## Combined Tool: Dependency Health

Working name: `@fait/dependency-health` (CLI: `depheal`)
Tagline: Complete dependency analysis for modern JavaScript/TypeScript projects – know what's used, what's missing, what's risky, and what's abandoned.

## Tool Structure and Architecture

```
@fait/dependency-health/
├── packages/
│   ├── core/                    # Core analysis engine
│   │   ├── src/
│   │   │   ├── analyzers/
│   │   │   │   ├── usage.ts           # From depcheck: used vs unused
│   │   │   │   ├── missing.ts         # From dependency-check: missing deps
│   │   │   │   ├── upgrade-risk.ts    # From dependency-checker: upgrade safety
│   │   │   │   ├── abandonment.ts     # From abandoned: age/risk scoring
│   │   │   │   └── security.ts        # NEW: npm audit / advisory checks
│   │   │   ├── parsers/
│   │   │   │   ├── javascript.ts      # JS/JSX parser
│   │   │   │   ├── typescript.ts      # TS/TSX parser
│   │   │   │   ├── svelte.ts          # SvelteKit support
│   │   │   │   ├── vue.ts             # Vue support
│   │   │   │   └── frameworks.ts      # Next.js, Remix patterns
│   │   │   ├── data-sources/
│   │   │   │   ├── npm.ts             # npm registry API
│   │   │   │   ├── github.ts          # GitHub API (last commit, stars)
│   │   │   │   └── advisories.ts      # Security advisories
│   │   │   └── index.ts               # Main analysis orchestrator
│   │   └── package.json
│   │
│   ├── cli/                     # Command-line interface
│   │   ├── src/
│   │   │   ├── commands/
│   │   │   │   ├── scan.ts            # Main scan command
│   │   │   │   ├── report.ts          # Generate reports
│   │   │   │   └── init.ts            # Initialize config
│   │   │   ├── reporters/
│   │   │   │   ├── console.ts         # Pretty console output
│   │   │   │   ├── json.ts            # JSON for CI
│   │   │   │   ├── html.ts            # HTML report
│   │   │   │   └── markdown.ts        # Markdown report
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── github-action/           # GitHub Action wrapper
│       ├── action.yml
│       ├── src/index.ts
│       └── package.json
│
├── examples/                    # Example projects to test against
│   ├── sveltekit-app/
│   ├── nextjs-app/
│   └── vanilla-node/
│
├── docs/                        # Documentation
│   ├── getting-started.md
│   ├── configuration.md
│   ├── analyzers.md
│   └── ci-integration.md
│
└── package.json                 # Monorepo root
```

## What Each Analyzer Does

### 1. Usage Analyzer (from depcheck)

```ts
// packages/core/src/analyzers/usage.ts

export interface UsageAnalysis {
  used: string[];           // Dependencies actually imported/required
  unused: string[];         // In package.json but never used
  devUnused: string[];      // In devDependencies but never used
}

export async function analyzeUsage(
  projectPath: string,
  options: UsageOptions
): Promise<UsageAnalysis> {
  // 1. Parse all source files (js, ts, jsx, tsx, svelte, vue)
  // 2. Extract import/require statements
  // 3. Compare against package.json dependencies
  // 4. Return used vs unused
}
```

Logic borrowed from depcheck:
- Parse AST of all source files.
- Detect imports: `import X from 'Y'`, `require('Y')`, `import('Y')`.
- Handle dynamic imports and framework-specific patterns.
- Cross-reference with package.json.

### 2. Missing Analyzer (from dependency-check)

```ts
// packages/core/src/analyzers/missing.ts

export interface MissingAnalysis {
  missing: string[];        // Used in code but not in package.json
  suggestions: Array<{
    module: string;
    suggestedPackage: string;
    reason: string;
  }>;
}

export async function analyzeMissing(
  projectPath: string,
  usageData: UsageAnalysis
): Promise<MissingAnalysis> {
  // 1. Take usageData.used
  // 2. Check which aren't in package.json
  // 3. Suggest where they should be added (deps vs devDeps)
}
```

Logic borrowed from dependency-check:
- Exit non-zero when missing deps found (CI-friendly).
- Separate analysis for production vs dev dependencies.

### 3. Upgrade Risk Analyzer (from dependency-checker)

```ts
// packages/core/src/analyzers/upgrade-risk.ts

export interface UpgradeRisk {
  package: string;
  current: string;
  latest: string;
  riskLevel: 'safe' | 'minor' | 'major' | 'breaking';
  reasons: string[];
}

export async function analyzeUpgradeRisk(
  dependencies: Record<string, string>
): Promise<UpgradeRisk[]> {
  // 1. For each dependency, fetch latest from npm
  // 2. Compare versions (semver)
  // 3. Flag:
  //    - Major version bumps (breaking)
  //    - 0.x versions (unstable)
  //    - Deprecated packages
  // 4. Return risk scores
}
```

Logic borrowed from dependency-checker:
- Detect major version bumps (1.x → 2.x).
- Flag pre-1.0 packages as inherently unstable.
- Warn about deprecated packages (from npm metadata).

### 4. Abandonment Analyzer (from abandoned + enhancements)

```ts
// packages/core/src/analyzers/abandonment.ts

export interface AbandonmentRisk {
  package: string;
  riskScore: number;        // 0-100
  signals: {
    lastPublish: Date | null;
    daysSincePublish: number;
    lastCommit: Date | null;
    daysSinceCommit: number;
    openIssues: number;
    hasActiveContributors: boolean;
    hasSecurityAdvisories: boolean;
  };
  recommendation: 'safe' | 'monitor' | 'replace';
  alternatives?: string[];
}

export async function analyzeAbandonment(
  dependencies: string[]
): Promise<AbandonmentRisk[]> {
  // 1. For each dependency:
  //    - Fetch npm publish date
  //    - Fetch GitHub repo (if available)
  //    - Get last commit date, issue count, contributor activity
  //    - Check for security advisories
  // 2. Calculate risk score:
  //    - No publish in 2+ years: +40 points
  //    - No commits in 1+ year: +30 points
  //    - Open CVEs: +20 points
  //    - No maintainer activity: +10 points
  // 3. Suggest alternatives (from community data or curated list)
}
```

Logic borrowed from abandoned:
- Last publish date check.

Enhancements we add:
- GitHub last commit date.
- Security advisory integration (npm audit, Snyk, GitHub advisories).
- Community-driven alternatives database.
- Risk scoring algorithm.

### 5. Security Analyzer (new)

```ts
// packages/core/src/analyzers/security.ts

export interface SecurityIssue {
  package: string;
  severity: 'low' | 'moderate' | 'high' | 'critical';
  advisory: string;
  cve?: string;
  patchedIn?: string;
  recommendation: string;
}

export async function analyzeSecurity(
  dependencies: Record<string, string>
): Promise<SecurityIssue[]> {
  // 1. Run npm audit equivalent
  // 2. Check GitHub Security Advisories
  // 3. Optional: integrate with Snyk/other services
  // 4. Return all issues with remediation advice
}
```

## CLI Interface Design

Basic usage:

```bash
# Install globally
npm install -g @fait/dependency-health

# Or use npx
npx @fait/dependency-health scan

# With options
depheal scan --format=json --output=report.json
depheal scan --only=unused,abandoned
depheal scan --ci  # Exit non-zero if issues found
```

Commands:

1. scan (main command)

```bash
depheal scan [path] [options]
```

Options:
- `--format <type>` Output format: `console|json|html|markdown` (default: `console`)
- `--output <file>` Write report to file
- `--only <analyzers>` Run only specific analyzers: `usage,missing,upgrade,abandonment,security`
- `--ignore <packages>` Ignore specific packages
- `--config <file>` Use config file (default: `.dephealrc.json`)
- `--ci` CI mode: exit non-zero on issues
- `--fix` Auto-fix issues where possible (remove unused, add missing)

2. report (view saved reports)

```bash
depheal report <file>

# Convert between formats
depheal report report.json --format=html --output=report.html
```

3. init (create config file)

```bash
depheal init

# Creates .dephealrc.json with defaults
```

## Configuration File (.dephealrc.json)

```json
{
  "analyzers": {
    "usage": {
      "enabled": true,
      "ignorePatterns": ["**/*.test.ts", "**/*.spec.ts"]
    },
    "missing": {
      "enabled": true
    },
    "upgradeRisk": {
      "enabled": true,
      "allowPrereleases": false
    },
    "abandonment": {
      "enabled": true,
      "riskThreshold": 60,
      "daysSincePublishWarning": 730
    },
    "security": {
      "enabled": true,
      "severityThreshold": "moderate"
    }
  },
  "ignore": [
    "@types/*"
  ],
  "thresholds": {
    "maxUnused": 0,
    "maxAbandoned": 5,
    "maxHighRiskUpgrades": 3
  },
  "ci": {
    "failOn": ["unused", "missing", "critical-security"]
  }
}
```

## Output Examples

Console output:

```
┌─────────────────────────────────────────────────────────┐
│  Dependency Health Report                               │
│  Scanned: 127 dependencies                              │
└─────────────────────────────────────────────────────────┘

Usage Analysis
   Used: 115 packages
   Unused: 8 packages
      - lodash (last used 6 months ago)
      - moment (suggest: date-fns)
      - request (deprecated)
      ...

Missing Dependencies
   4 packages used but not declared:
      - @sveltejs/kit (used in src/routes/+page.ts)
      - undici (used in src/lib/http.ts)
      ...

Upgrade Risk
   12 packages have major updates:
      - react: 17.0.2 → 18.2.0 (MAJOR)
      - typescript: 4.9.5 → 5.3.3 (MAJOR)
      ...

Abandonment Risk
   3 high-risk packages:
      - trim: Last publish 8.2 years ago, CVE-2020-7753
        - Suggest: Use native String.prototype.trim()
      - left-pad: Last publish 7.9 years ago
        - Suggest: Use native String.prototype.padStart()
      ...

Security
   2 critical vulnerabilities:
      - axios@0.21.1: CVE-2021-3749 (fixed in 0.21.2)
      - lodash@4.17.19: CVE-2020-8203 (fixed in 4.17.21)

──────────────────────────────────────────────────────────
Summary:
  115 dependencies healthy
  23 issues found
  2 critical security issues

Run 'depheal scan --fix' to auto-fix some issues.
```

JSON output (for CI):

```json
{
  "timestamp": "2026-02-07T10:57:00Z",
  "project": "/path/to/project",
  "summary": {
    "total": 127,
    "healthy": 115,
    "issues": 23,
    "critical": 2
  },
  "usage": {
    "used": ["package-a", "package-b"],
    "unused": ["lodash", "moment"]
  },
  "missing": ["@sveltejs/kit", "undici"],
  "upgradeRisk": [
    {
      "package": "react",
      "current": "17.0.2",
      "latest": "18.2.0",
      "riskLevel": "major"
    }
  ],
  "abandonment": [
    {
      "package": "trim",
      "riskScore": 95,
      "signals": {
        "daysSincePublish": 2993,
        "hasSecurityAdvisories": true
      },
      "recommendation": "replace",
      "alternatives": ["native String.prototype.trim()"]
    }
  ],
  "security": [
    {
      "package": "axios",
      "severity": "critical",
      "cve": "CVE-2021-3749",
      "patchedIn": "0.21.2"
    }
  ]
}
```

## GitHub Action

```
# .github/workflows/dependency-health.yml
name: Dependency Health Check

on:
  pull_request:
  schedule:
    - cron: '0 0 * * 0'  # Weekly

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run Dependency Health
        uses: fait-llc/dependency-health-action@v1
        with:
          fail-on: 'unused,missing,critical-security'
          format: 'markdown'

      - name: Comment PR
        uses: actions/github-script@v7
        with:
          script: |
            // Post markdown report as PR comment
```

## Implementation Phases

Phase 1: MVP (2-3 weekends)
- Usage analyzer (depcheck-style)
- Missing analyzer (dependency-check-style)
- Basic CLI with console output
- JSON output for CI
- Works for basic Node/TS projects

Phase 2: Polish (1-2 weeks)
- Upgrade risk analyzer
- Abandonment analyzer
- HTML report generation
- Configuration file support
- Better error handling

Phase 3: Advanced (2-3 weeks)
- Security analyzer (npm audit integration)
- Framework-specific parsers (SvelteKit, Next.js, Remix)
- GitHub Action
- Auto-fix capabilities (`--fix` flag)
- Monorepo support

Phase 4: Pro Features (ongoing)
- Web dashboard (multi-repo)
- Scheduled scans and alerts
- Team collaboration features
- Enterprise SSO, audit logs
- API for programmatic access

## Monetization Strategy

Open Source (Free)
- CLI tool (all analyzers)
- GitHub Action
- JSON/console/markdown output
- Single-repo usage

Pro (SaaS - $29-99/month)
- Web dashboard
- Multi-repo portfolio view
- Scheduled scans
- Email/Slack alerts
- HTML reports with branding
- Historical trends

Enterprise ($499-999/month)
- Self-hosted option
- SSO integration
- Audit logs
- Custom policies
- Priority support
- SLA guarantees

## First Steps to Build This

Initialize monorepo:

```bash
mkdir dependency-health
cd dependency-health
npm init -y
npm install -D typescript vitest tsup @changesets/cli
```

Create package structure:

```bash
mkdir -p packages/core/src/analyzers
mkdir -p packages/core/src/parsers
mkdir -p packages/cli/src
```

Start with usage analyzer:
- Study depcheck's parser approach.
- Build basic JS/TS import detector.
- Compare against package.json.
- Output used/unused lists.

Add CLI wrapper:
- Use commander.js or yargs.
- Implement scan command.
- Console reporter first.
- Iterate and add analyzers one by one.
