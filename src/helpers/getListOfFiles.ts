import { spawn, ChildProcess } from 'child_process';
import { debug, error as logError, log, warn as logWarn } from './logger';
import { RunGitOptions } from './runGit';

export interface GitFiles {
   newFiles: string[];
   modifiedFiles: string[];
   deletedFiles: string[];
}

const COMMANDS: Record<keyof GitFiles, string[]> = {
   newFiles: ['ls-files', '--others', '--exclude-standard'],
   modifiedFiles: ['ls-files', '--modified', '--exclude-standard'],
   deletedFiles: ['ls-files', '--deleted'],
};

/**
 * Collect changed files inside `repoPath`. Buffers stdout per command so multi-
 * chunk output (large repos) is captured correctly — the previous version only
 * kept the first chunk, which silently dropped files.
 */
export const getFiles = async (repoPath: string): Promise<GitFiles> => {
   log('getFiles: start', repoPath);
   const files: GitFiles = {
      newFiles: [],
      modifiedFiles: [],
      deletedFiles: [],
   };

   const promises = (Object.keys(COMMANDS) as (keyof GitFiles)[]).map((key) => {
      const args = COMMANDS[key];
      const options: RunGitOptions = { cwd: repoPath };
      return new Promise<void>((resolve, reject) => {
         const child: ChildProcess = spawn('git', args, options);
         let stdout = '';
         let stderr = '';
         child.stdout?.on('data', (chunk: Buffer) => {
            stdout += chunk.toString();
         });
         child.stderr?.on('data', (chunk: Buffer) => {
            stderr += chunk.toString();
         });
         child.on('error', (err) => {
            logError('getFiles: spawn error', { key, repoPath, err });
            reject(err);
         });
         child.on('close', (code: number) => {
            if (code !== 0) {
               logWarn('getFiles: non-zero exit', { key, repoPath, code, stderr: stderr.trim() });
               reject(new Error(`git ${args.join(' ')} failed: ${stderr.trim()}`));
               return;
            }
            files[key] = stdout
               .split('\n')
               .map((line) => line.trim())
               .filter((line) => line.length > 0);
            debug('getFiles: bucket filled', { key, repoPath, count: files[key].length, files: files[key] });
            resolve();
         });
      });
   });

   await Promise.all(promises);

   // A file can show up as both modified and deleted in some edge cases; keep
   // the deleted classification so we don't try to `git add` a vanished file.
   const before = files.modifiedFiles.length;
   files.modifiedFiles = files.modifiedFiles.filter((file) => !files.deletedFiles.includes(file));
   if (before !== files.modifiedFiles.length) {
      debug('getFiles: filtered modified ∩ deleted', { before, after: files.modifiedFiles.length });
   }

   log('getFiles: summary', {
      repoPath,
      newCount: files.newFiles.length,
      modifiedCount: files.modifiedFiles.length,
      deletedCount: files.deletedFiles.length,
   });
   return files;
};
