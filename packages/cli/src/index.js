import scan from './commands/scan.js';
import report from './commands/report.js';
import init from './commands/init.js';

const knownCommands = new Set(['scan', 'report', 'init']);

export default async function cli(
  argv,
  log = console.log,
  error = console.error,
  exit = (code) => {
    process.exitCode = code;
  },
) {
  const [maybeCommand, ...rest] = argv;
  const command = knownCommands.has(maybeCommand) ? maybeCommand : 'scan';
  const args = command === 'scan' && !knownCommands.has(maybeCommand)
    ? argv
    : rest;

  try {
    switch (command) {
      case 'scan':
        await scan(args, log, error, exit);
        break;
      case 'report':
        await report(args, log, error, exit);
        break;
      case 'init':
        await init(args, log, error, exit);
        break;
      default:
        error(`Unknown command: ${command}`);
        exit(1);
    }
  } catch (err) {
    error(err);
    exit(1);
  }
}
