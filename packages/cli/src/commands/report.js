import fs from 'fs';
import yargs from 'yargs';

import renderConsole from '../reporters/console.js';
import renderJson from '../reporters/json.js';
import renderMarkdown from '../reporters/markdown.js';
import renderHtml from '../reporters/html.js';

export default async function report(args, log, error, exit) {
  try {
    const argv = yargs(args)
      .usage('Usage: depheal report <file> [options]')
      .describe('format', 'Output format: console|json|html|markdown')
      .describe('output', 'Write report to file')
      .help('help', 'Show this help message')
      .argv;

    const file = argv._[0];
    if (!file) {
      throw new Error('Report file path is required.');
    }

    const content = fs.readFileSync(file, 'utf8');
    const reportData = JSON.parse(content);

    const format = argv.format || 'console';
    const output = argv.output;

    let rendered = '';
    switch (format) {
      case 'json':
        rendered = renderJson(reportData);
        break;
      case 'markdown':
        rendered = renderMarkdown(reportData);
        break;
      case 'html':
        rendered = renderHtml(reportData);
        break;
      case 'console':
      default:
        rendered = renderConsole(reportData, argv);
        break;
    }

    if (output) {
      fs.writeFileSync(output, rendered, 'utf8');
    } else {
      log(rendered);
    }

    exit(0);
  } catch (err) {
    error(err);
    exit(1);
  }
}
