import { ChildProcess, spawn } from 'child_process';
import { debug, error as logError, warn as logWarn } from './logger';

export interface RunGitOptions {
   /** Absolute path of the git repository to run the command inside. */
   cwd?: string;
}

export interface GitError extends Error {
   code: number | null;
   stderr: string;
   args: string[];
   cwd?: string;
}

const formatError = (args: string[], code: number | null, stderr: string, cwd?: string): GitError => {
   const err = new Error(`git ${args.join(' ')} failed (exit ${code ?? 'n/a'}): ${stderr.trim()}`) as GitError;
   err.code = code;
   err.stderr = stderr.trim();
   err.args = args;
   err.cwd = cwd;
   return err;
};

const describe = (args: string[], cwd?: string): string => {
   const tail = args.length > 0 ? ` ${args.join(' ')}` : '';
   return cwd ? `git (cwd=${cwd})${tail}` : `git${tail}`;
};

/**
 * Run a git command and resolve on exit 0. Rejects with stderr on non-zero exit.
 * Always uses the `cwd` option — never mutates process.chdir — so calls are
 * safe across multiple repos in the same extension host.
 */
export const runGit = (args: string[], options: RunGitOptions = {}): Promise<void> => {
   return new Promise((resolve, reject) => {
      debug('runGit: start', describe(args, options.cwd));
      const child: ChildProcess = spawn('git', args, { cwd: options.cwd });
      let stderr = '';
      child.stderr?.on('data', (chunk: Buffer) => {
         stderr += chunk.toString();
      });
      child.on('error', (err) => {
         logError('runGit: spawn error', describe(args, options.cwd), err);
         reject(err);
      });
      child.on('close', (code: number) => {
         if (code === 0) {
            debug('runGit: ok', describe(args, options.cwd), `exit=${code}`);
            resolve();
         } else {
            const trimmed = stderr.trim();
            const message = `git ${args.join(' ')} failed (exit ${code})${trimmed ? `: ${trimmed}` : ''}`;
            logWarn('runGit: non-zero exit', describe(args, options.cwd), `exit=${code}`, trimmed || '(no stderr)');
            reject(formatError(args, code, stderr, options.cwd));
         }
      });
   });
};

/** Same as {@link runGit} but returns the collected stdout. */
export const runGitCapture = (args: string[], options: RunGitOptions = {}): Promise<string> => {
   return new Promise((resolve, reject) => {
      debug('runGitCapture: start', describe(args, options.cwd));
      const child: ChildProcess = spawn('git', args, { cwd: options.cwd });
      let stdout = '';
      let stderr = '';
      child.stdout?.on('data', (chunk: Buffer) => {
         stdout += chunk.toString();
      });
      child.stderr?.on('data', (chunk: Buffer) => {
         stderr += chunk.toString();
      });
      child.on('error', (err) => {
         logError('runGitCapture: spawn error', describe(args, options.cwd), err);
         reject(err);
      });
      child.on('close', (code: number) => {
         if (code === 0) {
            const preview = stdout.length > 200 ? `${stdout.slice(0, 200)}…(${stdout.length} chars)` : stdout;
            debug('runGitCapture: ok', describe(args, options.cwd), `exit=${code}`, 'stdout=', preview);
            resolve(stdout);
         } else {
            const trimmed = stderr.trim();
            logWarn('runGitCapture: non-zero exit', describe(args, options.cwd), `exit=${code}`, trimmed || '(no stderr)');
            reject(formatError(args, code, stderr, options.cwd));
         }
      });
   });
};
