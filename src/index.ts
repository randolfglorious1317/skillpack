import { Command } from 'commander';

import { runCurate } from './curate/index.js';
import { runMapDiff } from './map/diff.js';
import { runMapFetch } from './map/fetch.js';
import { runMapHtml } from './map/html.js';
import { runMapTokens } from './map/tokens.js';
import { runPick } from './pick/output.js';

const program = new Command();

program
  .name('skillpack')
  .description(
    'Recommend and safely combine meta-skill frameworks for AI coding agents',
  )
  .version('2.0.0');

program
  .command('pick')
  .description(
    'Interactive quiz → one primary router (or none) + safe cherry-pick list + install snippets',
  )
  .option('-y, --yes', 'Non-interactive (requires --answers)')
  .option('--answers <file>', 'JSON file of quiz answers (questionId → optionId)')
  .option('--json', 'Emit recommendation as JSON')
  .action(async (opts: { yes?: boolean; answers?: string; json?: boolean }) => {
    try {
      await runPick({
        yes: opts.yes,
        answersPath: opts.answers,
        json: opts.json,
      });
    } catch (err) {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

const map = program
  .command('map')
  .description('Inventory, diff, tokens, and HTML report for skill packs');

map
  .command('fetch')
  .description(
    'Download & parse pack repos into the local cache (or a custom --repo)',
  )
  .option('--refresh', 'Force re-download even if cache exists')
  .option(
    '--repo <owner/repo[/path]>',
    'Fetch an arbitrary skills repo and merge as a custom pack',
  )
  .action(async (opts: { refresh?: boolean; repo?: string }) => {
    try {
      await runMapFetch({ refresh: opts.refresh, repo: opts.repo });
    } catch (err) {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

map
  .command('diff')
  .description(
    'Unique / overlapping / conflict report across the packs',
  )
  .option('--json', 'Emit structured JSON')
  .option(
    '--fail-on-collision',
    'Exit 1 if any red conflict is found (for CI)',
  )
  .action(
    async (opts: { json?: boolean; failOnCollision?: boolean }) => {
      try {
        const code = await runMapDiff({
          json: opts.json,
          failOnCollision: opts.failOnCollision,
        });
        process.exitCode = code;
      } catch (err) {
        console.error(err instanceof Error ? err.message : err);
        process.exit(1);
      }
    },
  );

map
  .command('tokens')
  .description(
    'Per-pack context tax and heaviest skills (chars÷4 token estimate)',
  )
  .option('--json', 'Emit structured JSON')
  .action(async (opts: { json?: boolean }) => {
    try {
      await runMapTokens({ json: opts.json });
    } catch (err) {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

map
  .command('html')
  .description('Write a self-contained skillpack-map.html report')
  .option('-o, --output <path>', 'Output path', 'skillpack-map.html')
  .action(async (opts: { output?: string }) => {
    try {
      await runMapHtml({ output: opts.output });
    } catch (err) {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

program
  .command('curate')
  .description(
    'Build a minimal skill set by workflow phase; save/apply named profiles',
  )
  .option('--apply <name|file>', 'Apply a saved profile (cleans previous skillpack install)')
  .option('--save-as <name>', 'Save the selection as a named profile')
  .option('--dest <path>', 'Install destination (default ~/.claude/skills)')
  .option('--list', 'List saved profiles')
  .option('-y, --yes', 'Non-interactive confirm (with --save-as for install)')
  .action(
    async (opts: {
      apply?: string;
      saveAs?: string;
      dest?: string;
      list?: boolean;
      yes?: boolean;
    }) => {
      try {
        await runCurate({
          apply: opts.apply,
          saveAs: opts.saveAs,
          dest: opts.dest,
          list: opts.list,
          yes: opts.yes,
        });
      } catch (err) {
        console.error(err instanceof Error ? err.message : err);
        process.exit(1);
      }
    },
  );

program.parse();
