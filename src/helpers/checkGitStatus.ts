import { debug, error as logError, log, warn as logWarn } from './logger';
import { runGitCapture } from './runGit';

export interface GitStatus {
   error: string;
   message: string;
   /** True when `git status --porcelain` returns empty (clean tree). */
   clean: boolean;
}

/**
 * Check the status of the repository at `repoPath`. Pure / non-mutating.
 * Uses `git status --porcelain` for a deterministic, machine-readable result
 * instead of relying on the human-readable "nothing to commit" string.
 */
export const checkGitStatus = async (repoPath: string): Promise<GitStatus> => {
   log('checkGitStatus: start', repoPath);
   try {
      const out = await runGitCapture(['status', '--porcelain'], { cwd: repoPath });
      const clean = out.trim().length === 0;
      const preview = out.length > 400 ? `${out.slice(0, 400)}…(${out.length} chars)` : out;
      debug('checkGitStatus: porcelain output', { cwd: repoPath, clean, preview });
      log('checkGitStatus: result', { repoPath, clean });
      return {
         error: '',
         message: clean ? 'All files are committed!' : '',
         clean,
      };
   } catch (err: any) {
      const stderr: string = err?.stderr ?? err?.message ?? String(err);
      if (stderr.includes('not a git repository')) {
         logWarn('checkGitStatus: not a git repository', repoPath);
         return { error: 'Git is not initialized in this directory!', message: '', clean: true };
      }
      logError('checkGitStatus: failed', repoPath, stderr);
      return { error: stderr || 'Unknown git error', message: '', clean: true };
   }
};
