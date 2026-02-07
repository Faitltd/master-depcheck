const path = require('path');
const fse = require('fs-extra');
const { setContent } = require('../packages/core/dist/utils/file');

function resolveShortPath(expected, moduleName) {
  return Object.keys(expected).reduce(
    (obj, key) => ({
      ...obj,
      [key]: expected[key].map((name) =>
        path.resolve(__dirname, 'fake_modules', moduleName, name),
      ),
    }),
    {},
  );
}

function random() {
  return Math.random().toString().substring(2);
}

function getTestParserWithTempFile(parser) {
  return async (content, filename, deps, rootDir) => {
    const tempFolder = path.resolve(rootDir, `temp-${random()}`);
    const tempPath = path.resolve(tempFolder, filename);
    await fse.ensureDir(tempFolder);
    await fse.outputFile(tempPath, content);
    const result = await parser(tempPath, deps, tempFolder);
    const fileFolder = path.dirname(tempPath);
    await fse.remove(tempPath);
    await fse.remove(fileFolder);
    return result;
  };
}

function getTestParserWithContentPromise(parser) {
  return async (content, filename, deps, rootDir) => {
    setContent(filename, content);
    return parser(filename, deps, rootDir);
  };
}

module.exports = {
  resolveShortPath,
  getTestParserWithTempFile,
  getTestParserWithContentPromise,
};
