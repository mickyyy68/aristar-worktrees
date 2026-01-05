import { invoke } from '@tauri-apps/api/core';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

let logFilePath: string | null = null;
let logRotationChecked = false;
const MAX_LOG_FILES = 5;
const MAX_LOG_SIZE_BYTES = 10 * 1024 * 1024;

async function getLogFilePath(): Promise<string> {
  if (logFilePath) return logFilePath;
  try {
    logFilePath = await invoke<string>('get_log_file_path');
  } catch {
    logFilePath = '';
  }
  return logFilePath;
}

async function checkLogRotation(): Promise<void> {
  if (logRotationChecked) return;
  logRotationChecked = true;

  const path = await getLogFilePath();
  if (!path) return;

  try {
    await invoke('rotate_logs_if_needed', {
      maxSize: MAX_LOG_SIZE_BYTES,
      maxFiles: MAX_LOG_FILES,
    });
  } catch {
  }
}

async function writeToFile(content: string): Promise<void> {
  const path = await getLogFilePath();
  if (!path) return;

  try {
    await invoke('append_to_log_file', { path, content });
  } catch {
  }
}

export class Logger {
  private level: LogLevel;

  constructor(level: LogLevel = import.meta.env.DEV ? 'DEBUG' : 'INFO') {
    this.level = level;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }

  private formatMessage(level: LogLevel, prefix: string, message: string, data?: unknown): string {
    const timestamp = new Date().toISOString();
    const dataStr = data !== undefined ? ` ${JSON.stringify(data)}` : '';
    return `[${timestamp}] [${level}] ${prefix} ${message}${dataStr}`;
  }

  async debug(prefix: string, message: string, data?: unknown): Promise<void> {
    if (!this.shouldLog('DEBUG')) return;
    const formatted = this.formatMessage('DEBUG', prefix, message, data);
    await writeToFile(formatted + '\n');
    await checkLogRotation();
  }

  async info(prefix: string, message: string, data?: unknown): Promise<void> {
    if (!this.shouldLog('INFO')) return;
    const formatted = this.formatMessage('INFO', prefix, message, data);
    await writeToFile(formatted + '\n');
    await checkLogRotation();
  }

  async warn(prefix: string, message: string, data?: unknown): Promise<void> {
    if (!this.shouldLog('WARN')) return;
    const formatted = this.formatMessage('WARN', prefix, message, data);
    await writeToFile(formatted + '\n');
    await checkLogRotation();
  }

  async error(prefix: string, message: string, data?: unknown): Promise<void> {
    if (!this.shouldLog('ERROR')) return;
    const formatted = this.formatMessage('ERROR', prefix, message, data);
    await writeToFile(formatted + '\n');
    await checkLogRotation();
  }
}

export const logger = new Logger();
