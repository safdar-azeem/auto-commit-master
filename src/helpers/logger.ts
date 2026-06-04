import * as vscode from 'vscode';

const PREFIX = '[AutoCommitMaster]';
let channel: vscode.OutputChannel | null = null;
let verbose = false;

const timestamp = (): string => {
   const d = new Date();
   const hh = String(d.getHours()).padStart(2, '0');
   const mm = String(d.getMinutes()).padStart(2, '0');
   const ss = String(d.getSeconds()).padStart(2, '0');
   const ms = String(d.getMilliseconds()).padStart(3, '0');
   return `${hh}:${mm}:${ss}.${ms}`;
};

const stringify = (value: unknown): string => {
   if (typeof value === 'string') return value;
   if (value instanceof Error) {
      return `${value.name}: ${value.message}${value.stack ? `\n${value.stack}` : ''}`;
   }
   try {
      return JSON.stringify(value, null, 2);
   } catch {
      return String(value);
   }
};

const formatLine = (level: string, args: unknown[]): string => {
   const body = args.map(stringify).join(' ');
   return `${timestamp()} ${level} ${PREFIX} ${body}`;
};

const write = (level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', args: unknown[]): void => {
   const line = formatLine(level, args);
   switch (level) {
      case 'WARN':
         console.warn(line);
         break;
      case 'ERROR':
         console.error(line);
         break;
      case 'DEBUG':
         console.debug(line);
         break;
      default:
         console.log(line);
   }
   if (channel) {
      channel.appendLine(line);
   }
};

/** Wire the logger to a dedicated OutputChannel. Call once from activate(). */
export const initLogger = (ch: vscode.OutputChannel, options: { verbose?: boolean } = {}): void => {
   channel = ch;
   verbose = options.verbose ?? false;
   write('INFO', ['logger initialized', { verbose }]);
};

/** Toggle verbose mode at runtime (used by the config setting). */
export const setVerbose = (value: boolean): void => {
   verbose = value;
   write('INFO', [`verbose = ${verbose}`]);
};

export const isVerbose = (): boolean => verbose;

/** Always logged — high-level lifecycle and command entries. */
export const log = (...args: unknown[]): void => write('INFO', args);
export const info = log;

/** Recoverable problem that the user should see. */
export const warn = (...args: unknown[]): void => write('WARN', args);

/** Hard failure (git rejected, unexpected exception, etc.). */
export const error = (...args: unknown[]): void => write('ERROR', args);

/** Only emitted when verbose mode is on. Use for per-file / per-command detail. */
export const debug = (...args: unknown[]): void => {
   if (verbose) write('DEBUG', args);
};

/** Show the Output panel to the user. `preserveFocus=true` keeps the editor focused. */
export const show = (preserveFocus = false): void => {
   channel?.show(preserveFocus);
};

export const dispose = (): void => {
   channel?.dispose();
   channel = null;
};
