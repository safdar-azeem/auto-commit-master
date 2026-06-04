import * as fs from 'fs';
import * as path from 'path';
import { debug, error as logError, log, warn as logWarn } from './logger';

export interface GitFolder {
   path: string;
   name: string;
}

const isGitMarker = (p: string): boolean => {
   try {
      const stat = fs.statSync(p);
      // `.git` is normally a directory, but for submodules / worktrees it can be a
      // file containing `gitdir: ...`. Either form means "this is a repo".
      return stat.isDirectory() || stat.isFile();
   } catch {
      return false;
   }
};

/**
 * Find git repositories relevant to `parentPath`.
 *
 * Rules:
 *  - If `parentPath` itself is a repo AND it has child repos, return ONLY the
 *    children. The parent in that shape is a "parent repo" holding sibling
 *    sub-repos — committing at the parent level would record submodule pointer
 *    changes, which is almost never what the user wants.
 *  - If `parentPath` is a repo and has no child repos, return the parent.
 *  - If `parentPath` is not a repo, return whichever immediate children are repos.
 */
export const findGitFolders = async (parentPath: string): Promise<GitFolder[]> => {
   log('findGitFolders: scanning', parentPath);
   const parentHasGit = isGitMarker(path.join(parentPath, '.git'));
   const childGitFolders: GitFolder[] = [];

   try {
      const items = fs.readdirSync(parentPath);
      debug('findGitFolders: readdir', parentPath, `entries=${items.length}`);
      for (const item of items) {
         const itemPath = path.join(parentPath, item);
         let isDir = false;
         try {
            isDir = fs.statSync(itemPath).isDirectory();
         } catch (err) {
            logWarn('findGitFolders: stat failed', itemPath, err);
            continue;
         }
         if (!isDir) continue;
         if (isGitMarker(path.join(itemPath, '.git'))) {
            childGitFolders.push({ path: itemPath, name: item });
            debug('findGitFolders: child repo', itemPath);
         }
      }
   } catch (error) {
      logError('findGitFolders: readdir failed', parentPath, error);
   }

   debug('findGitFolders: scan summary', {
      parentPath,
      parentHasGit,
      childCount: childGitFolders.length,
   });

   if (parentHasGit && childGitFolders.length > 0) {
      log('findGitFolders: parent has .git AND child repos exist → returning children only');
      log(
         'findGitFolders: result',
         childGitFolders.map((g) => g.path)
      );
      return childGitFolders;
   }
   if (parentHasGit) {
      log('findGitFolders: parent has .git, no child repos → returning parent');
      return [{ path: parentPath, name: path.basename(parentPath) }];
   }
   log(
      'findGitFolders: parent has no .git → returning child repos (if any)',
      childGitFolders.map((g) => g.path)
   );
   return childGitFolders;
};
