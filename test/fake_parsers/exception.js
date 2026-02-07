const { getContent } = require('../../packages/core/dist/utils/file');

module.exports = async (filename) => {
  const content = await getContent(filename);
  throw new SyntaxError(content);
};
