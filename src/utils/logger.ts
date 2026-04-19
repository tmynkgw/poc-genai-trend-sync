import pino from 'pino';

export const logger = pino({
  level: process.env['LOG_LEVEL'] ?? 'info',
  redact: {
    paths: ['*.apiKey', '*.token', '*.secret', 'GEMINI_API_KEY', 'NOTION_API_KEY', 'GITHUB_TOKEN'],
    censor: '[REDACTED]',
  },
});
