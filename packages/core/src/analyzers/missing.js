import depcheck from '../depcheck';

export async function analyzeMissing(projectPath, options = {}) {
  const result = await depcheck(projectPath, { ...options, skipMissing: false });
  return {
    missing: Object.keys(result.missing || {}),
    suggestions: [],
    details: result.missing || {},
  };
}
