# Dependency Health

Complete dependency analysis for modern JavaScript/TypeScript projects — know what's used, what's missing, what's risky, and what's abandoned.

This repo is mid-refactor from depcheck into a Dependency Health monorepo. The current implementation supports usage and missing-dependency analysis with a new CLI layout. Other analyzers are scaffolded.

## Packages

- `@fait/dependency-health-core` – core analysis engine (usage + missing)
- `@fait/dependency-health` – CLI (`depheal`)
- `@fait/dependency-health-github-action` – GitHub Action wrapper (stub)

## CLI

Install globally:

```bash
npm install -g @fait/dependency-health
```

Or via npx:

```bash
npx @fait/dependency-health scan
```

Common usage:

```bash
# Scan a project

depheal scan /path/to/project

# JSON report

depheal scan --format=json --output=report.json

# Only run specific analyzers

depheal scan --only=usage,missing

# CI mode (exit non-zero on issues)

depheal scan --ci
```

Commands:

- `scan [path]` – run analysis
- `report <file>` – render a saved JSON report in another format
- `init [path]` – create `.dephealrc.json`

## Configuration

Create `.dephealrc.json`:

```json
{
  "analyzers": {
    "usage": { "enabled": true },
    "missing": { "enabled": true }
  },
  "ignore": ["@types/*"],
  "ci": {
    "failOn": ["unused", "missing", "critical-security"]
  }
}
```

## Docs

- `docs/dependency-health-design.md`
- `docs/getting-started.md`
- `docs/configuration.md`
- `docs/analyzers.md`
- `docs/ci-integration.md`

## Status

- Usage and missing-dependency analysis are working.
- Upgrade risk, abandonment, and security analyzers are scaffolded (no runtime logic yet).
- GitHub Action wrapper is a stub.

## Development

```bash
npm install
npm test
```

## Legacy

The original depcheck docs are still available in `doc/pluggable-design.md` for reference.
