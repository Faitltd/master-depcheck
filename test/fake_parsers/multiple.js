const { getContent } = require('../../packages/core/dist/utils/file');

function parser(prefix, content) {
  return content
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((line) => line.startsWith(prefix))
    .map((line) => ({
      type: 'ImportDeclaration',
      source: {
        type: 'Literal',
        value: line.substring(prefix.length),
      },
    }));
}

const multipleParserA = async (filename) => {
  const content = await getContent(filename);
  return parser('parser_a,', content);
};

const multipleParserB = async (filename) => {
  const content = await getContent(filename);
  return parser('parser_b,', content);
};

module.exports = {
  multipleParserA,
  multipleParserB,
};
