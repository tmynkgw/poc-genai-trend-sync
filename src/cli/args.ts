import { Command } from 'commander';

export interface ParsedArgs {
  maxArticles?: number;
  lookbackDays?: number;
  test: boolean;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const program = new Command()
    .name('genai-trend-sync')
    .description('AI trend article collector and Notion publisher')
    .option('--max-articles <n>', 'Max articles per source', parseInt)
    .option('--lookback-days <n>', 'Number of days to look back', parseInt)
    .option('--test', 'Run in test mode (use NOTION_DATABASE_ID_TEST)', false)
    .allowUnknownOption(false);

  program.parse(argv);
  const opts = program.opts<{ maxArticles?: number; lookbackDays?: number; test: boolean }>();

  return {
    maxArticles: opts.maxArticles,
    lookbackDays: opts.lookbackDays,
    test: opts.test,
  };
}
