require('should');
const parser = require('../../packages/core/dist/special/husky');
const { getTestParserWithContentPromise } = require('../utils');

const testParser = getTestParserWithContentPromise(parser);

describe('husky special parser', () => {
  it('should ignore when filename is not supported', async () => {
    const result = await parser('not-supported.txt', [], '/root/dir');
    result.should.deepEqual([]);
  });

  it('should detect husky when used', async () => {
    const expected = ['husky'];
    const content = JSON.stringify({
      husky: {
        hooks: {
          'pre-commit': 'yarn tsc && yarn lint-staged',
        },
      },
    });
    const actual = await testParser(content, '/path/to/package.json');
    actual.should.deepEqual(expected);
  });
});
