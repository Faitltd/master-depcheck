const { getContent } = require('../../packages/core/dist/utils/file');

function toRequire(dep) {
  return {
    type: 'ImportDeclaration',
    source: {
      type: 'Literal',
      value: dep,
    },
  };
}

async function lite(filename) {
  const content = await getContent(filename);
  return content
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((line) => line);
}

async function full(filename) {
  const result = await lite(filename);
  return result.map(toRequire);
}

module.exports = {
  lite,
  full,
};
