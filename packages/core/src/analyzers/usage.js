import depcheck from '../depcheck';

export async function analyzeUsage(projectPath, options = {}) {
  const result = await depcheck(projectPath, { ...options, skipMissing: true });
  return {
    used: Object.keys(result.using || {}),
    unused: result.dependencies || [],
    devUnused: result.devDependencies || [],
  };
}
