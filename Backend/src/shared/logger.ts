type LogLevel = 'info' | 'error';

function write(level: LogLevel, message: string, fields: Record<string, unknown> = {}): void {
  process.stdout.write(`${JSON.stringify({ timestamp: new Date().toISOString(), level, message, ...fields })}\n`);
}

export const logger = {
  info: (message: string, fields?: Record<string, unknown>) => write('info', message, fields),
  error: (message: string, fields?: Record<string, unknown>) => write('error', message, fields)
};
