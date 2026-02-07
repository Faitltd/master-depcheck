require('should');
const parser = require('../../packages/core/dist/special/feross-standard');
const { getTestParserWithContentPromise } = require('../utils');

const testParser = getTestParserWithContentPromise(parser);

describe('feross standard special parser', () => {
  it('should ignore when it is not `package.json`', async () => {
    const result = await parser('/a/file', ['standard'], '/a');
    result.should.deepEqual([]);
  });

  it('should recognize the parser used by feross standard', async () => {
    const metadata = {
      standard: {
        parser: 'babel-eslint',
      },
    };

    const content = JSON.stringify(metadata);
    const result = await testParser(
      content,
      '/a/package.json',
      ['standard'],
      '/a',
    );
    result.should.deepEqual(['babel-eslint']);
  });
});
