import * as fs from 'fs';
import * as path from 'path';
import { debug, error as logError, log, warn as logWarn } from './logger';
import { runGit, runGitCapture } from './runGit';
import { generateCommitMessage } from './generateCommitMessage';

export type FileAction = 'Add' | 'Update' | 'Delete' | 'none';

export interface CommitSingleFileOptions {
   /** Absolute path to the git repository root. */
   repoPath: string;
   /** Repository-relative path of the file. */
   relativePath: string;
   /** Optional stop predicate checked between git invocations. */
   shouldStop?: () => boolean;
}

export interface CommitSingleFileResult {
   committed: boolean;
   action: FileAction;
   message?: string;
   reason?: string;
}

/**
 * Walk up the directory tree from `filePath` until we find a `.git` marker
 * (directory or file — covers submodules/worktrees). Returns `null` if the
 * file is not inside any git repo reachable from its filesystem location.
 */
export const findRepoRoot = (filePath: string): string | null => {
   log('findRepoRoot: start', filePath);
   let dir = path.dirname(filePath);
   const { root } = path.parse(dir);
   let steps = 0;
   while (dir !== root) {
      const marker = path.join(dir, '.git');
      if (fs.existsSync(marker)) {
         log('findRepoRoot: resolved', { filePath, repoPath: dir, steps });
         return dir;
      }
      dir = path.dirname(dir);
      steps++;
   }
   logWarn('findRepoRoot: no .git found above', filePath, { steps });
   return null;
};

/**
 * Map a porcelain v1 status code to the action we want to perform.
 * Porcelain format: `XY path` where X = index, Y = worktree.
 *   `?? path`            -> untracked -> Add
 *   ` M path` / `M  path` -> modified  -> Update
 *   `MM path` etc.       -> any combination -> Update
 *   ` D path` / `D  path` -> deleted   -> Delete
 *   `A  path` / `AM path` -> already staged add -> Add
 */
const classifyStatus = (code: string): FileAction => {
   const x = code[0] ?? ' ';
   const y = code[1] ?? ' ';
   if (x === '?' && y === '?') return 'Add';
   if (x === ' ' && y === 'D') return 'Delete';
   if (x === 'D' && (y === ' ' || y === 'D')) return 'Delete';
   if (x === 'A') return 'Add';
   if (x !== ' ' || y !== ' ') return 'Update';
   return 'none';
};

const detectStatus = async (repoPath: string, relativePath: string): Promise<FileAction> => {
   const out = await runGitCapture(['status', '--porcelain', '--', relativePath], { cwd: repoPath });
   const firstLine = out
      .split('\n')
      .map((l) => l.trimEnd())
      .find((l) => l.length >= 3);
   if (!firstLine) {
      debug('commitSingleFile.detectStatus: no porcelain entry', { repoPath, relativePath });
      return 'none';
   }
   const action = classifyStatus(firstLine.slice(0, 2));
   debug('commitSingleFile.detectStatus: classified', { repoPath, relativePath, code: firstLine.slice(0, 2), action });
   return action;
};

/**
 * Stage (or remove) and commit a single file inside `repoPath`. Designed to
 * preserve correct history + per-commit timestamps because each `git commit`
 * is its own transaction — that property is independent of bulk vs. single.
 *
 * Returns a result describing what (if anything) happened. The caller is
 * responsible for surfacing errors to the user; this function rejects only on
 * hard git failures (e.g. command not found, pre-commit hook rejected).
 */
export const commitSingleFile = async (
   options: CommitSingleFileOptions
): Promise<CommitSingleFileResult> => {
   const { repoPath, relativePath, shouldStop } = options;
   log('commitSingleFile: start', { repoPath, relativePath });

   const action = await detectStatus(repoPath, relativePath);
   log('commitSingleFile: detected action', { repoPath, relativePath, action });
   if (action === 'none') {
      return { committed: false, action, reason: 'no-changes' };
   }
   if (shouldStop?.()) {
      logWarn('commitSingleFile: stopped before staging', { repoPath, relativePath, action });
      return { committed: false, action, reason: 'stopped' };
   }

   try {
      if (action === 'Delete') {
         log('commitSingleFile: running git rm', { repoPath, relativePath });
         await runGit(['rm', '--', relativePath], { cwd: repoPath });
      } else {
         log('commitSingleFile: running git add', { repoPath, relativePath, action });
         await runGit(['add', '--', relativePath], { cwd: repoPath });
      }
   } catch (err) {
      logError('commitSingleFile: stage failed', { repoPath, relativePath, action, err });
      throw err;
   }

   if (shouldStop?.()) {
      logWarn('commitSingleFile: stopped after staging, before commit', { repoPath, relativePath, action });
      return { committed: false, action, reason: 'stopped' };
   }

   const message = generateCommitMessage(relativePath, action);
   try {
      log('commitSingleFile: running git commit', { repoPath, relativePath, message });
      await runGit(['commit', '-m', message], { cwd: repoPath });
   } catch (err) {
      logError('commitSingleFile: commit failed', { repoPath, relativePath, message, err });
      throw err;
   }

   log('commitSingleFile: success', { repoPath, relativePath, action, message });
   return { committed: true, action, message };
};
