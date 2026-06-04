import * as path from 'path';
import * as vscode from 'vscode';
import { getFiles } from './helpers/getListOfFiles';
import { runGit } from './helpers/runGit';
import { checkGitStatus } from './helpers/checkGitStatus';
import { generateCommitMessage } from './helpers/generateCommitMessage';
import { findGitFolders, GitFolder } from './helpers/checkGitFolders';
import { commitSingleFile, findRepoRoot } from './helpers/commitSingleFile';
import { debug, error as logError, initLogger, log, setVerbose, show as showLogs, warn as logWarn } from './helpers/logger';

let stopFlag = false;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Process every changed file inside `repoPath` as its own commit. Each `git
 * commit` is a separate transaction, so history + per-commit timestamps are
 * correct regardless of bulk vs. single-file invocation.
 */
const addGitCommits = async (repoPath: string): Promise<void> => {
   log('addGitCommits: start', repoPath);
   const files = await getFiles(repoPath);
   const { newFiles, modifiedFiles, deletedFiles } = files;
   log('addGitCommits: bucket sizes', {
      repoPath,
      new: newFiles.length,
      modified: modifiedFiles.length,
      deleted: deletedFiles.length,
   });

   // Process deleted files first
   for (const file of deletedFiles) {
      if (stopFlag) {
         logWarn('addGitCommits: stopFlag set, halting (deletions loop)', { repoPath, file });
         return;
      }
      const message = generateCommitMessage(file, 'Delete');
      log('addGitCommits: deleting', { repoPath, file, message });
      await runGit(['rm', '--', file], { cwd: repoPath });
      await runGit(['commit', '-m', message], { cwd: repoPath });
      debug('addGitCommits: deleted+committed', { repoPath, file });
   }

   // Process modified files second
   for (const file of modifiedFiles) {
      if (stopFlag) {
         logWarn('addGitCommits: stopFlag set, halting (modifications loop)', { repoPath, file });
         return;
      }
      const message = generateCommitMessage(file, 'Update');
      log('addGitCommits: updating', { repoPath, file, message });
      await runGit(['add', '--', file], { cwd: repoPath });
      await runGit(['commit', '-m', message], { cwd: repoPath });
      debug('addGitCommits: added+committed', { repoPath, file });
   }

   // Process new files last
   for (const file of newFiles) {
      if (stopFlag) {
         logWarn('addGitCommits: stopFlag set, halting (additions loop)', { repoPath, file });
         return;
      }
      const message = generateCommitMessage(file, 'Add');
      log('addGitCommits: adding', { repoPath, file, message });
      await runGit(['add', '--', file], { cwd: repoPath });
      await runGit(['commit', '-m', message], { cwd: repoPath });
      debug('addGitCommits: added+committed', { repoPath, file });
   }

   log('addGitCommits: done', repoPath);
};

/** Collect every git repo reachable from any open workspace folder, deduped. */
const collectGitFolders = async (): Promise<GitFolder[]> => {
   const folders = vscode.workspace.workspaceFolders;
   log('collectGitFolders: workspaceFolders', folders?.length ?? 0);
   if (!folders || folders.length === 0) {
      logWarn('collectGitFolders: no workspace folders open');
      return [];
   }
   for (const folder of folders) {
      log('collectGitFolders: workspace folder', folder.uri.fsPath, folder.name);
   }

   const found: GitFolder[] = [];
   for (const folder of folders) {
      const result = await findGitFolders(folder.uri.fsPath);
      found.push(...result);
   }
   log('collectGitFolders: raw candidates', found.map((g) => g.path));

   // De-dupe by absolute path in case two workspace folders share a repo.
   const seen = new Set<string>();
   const unique: GitFolder[] = [];
   for (const g of found) {
      if (seen.has(g.path)) continue;
      seen.add(g.path);
      unique.push(g);
   }
   log('collectGitFolders: unique repos', unique.map((g) => `${g.name}@${g.path}`));
   return unique;
};

export function activate(context: vscode.ExtensionContext) {
   // -- Logger setup ----------------------------------------------------------
   const outputChannel = vscode.window.createOutputChannel('Auto Commit Master');
   context.subscriptions.push(outputChannel);
   const verbose = vscode.workspace.getConfiguration().get<boolean>('autoCommitMaster.verbose', false);
   initLogger(outputChannel, { verbose });
   log('activate: extension activated', {
      version: context.extension.packageJSON.version,
      extensionPath: context.extension.extensionPath,
      verbose,
   });

   // React to config changes so the verbose toggle takes effect without reload.
   context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
         if (e.affectsConfiguration('autoCommitMaster.verbose')) {
            const next = vscode.workspace.getConfiguration().get<boolean>('autoCommitMaster.verbose', false);
            setVerbose(!!next);
         }
      })
   );

   const setActive = (active: boolean) =>
      vscode.commands.executeCommand('setContext', 'autoCommitMaster.active', active);

   // -- Bulk: commit every changed file in the repo of the clicked SCM panel --
   const start = vscode.commands.registerCommand('auto-commit-master.start', async (...args: unknown[]) => {
      log('start: command invoked');
      log('start: raw args', args.map((a) => (a === null ? 'null' : typeof a === 'object' ? Object.keys(a as object) : typeof a)));
      showLogs(true);

      // Resolve the target repo with this priority:
      //   1. SourceControl passed by VS Code when invoked from an SCM title
      //      button. Each repo in the workspace has its own SourceControl, and
      //      VS Code hands the matching one to the command — this is the
      //      "clicked button → commit in that repo" path.
      //   2. Active editor's file (palette / shortcut invocation).
      //   3. The single discovered repo (single-repo workspace).
      //   4. Error — no way to disambiguate, never auto-commit across repos.
      const sourceControl = args.find(
         (a): a is vscode.SourceControl =>
            !!a && typeof a === 'object' && 'rootUri' in (a as object) && 'id' in (a as object)
      );
      log('start: SourceControl detected from args', {
         found: !!sourceControl,
         id: sourceControl?.id,
         label: sourceControl?.label,
         rootUri: sourceControl?.rootUri?.fsPath,
      });

      let targets: GitFolder[] = [];

      if (sourceControl?.rootUri) {
         const repoPath = sourceControl.rootUri.fsPath;
         const repoName = path.basename(repoPath) || repoPath;
         targets = [{ path: repoPath, name: repoName }];
         log('start: scoped to SourceControl root', { repoPath, repoName });
      } else {
         log('start: no SourceControl, falling back to discovery');
         const gitFolders = await collectGitFolders();
         if (gitFolders.length === 0) {
            logWarn('start: no git repositories discovered');
            vscode.window.showErrorMessage('No Git repositories found in the workspace');
            setActive(false);
            return;
         }

         if (gitFolders.length === 1) {
            targets = gitFolders;
            log('start: single repo workspace, using it', gitFolders[0]);
         } else {
            const activeFilePath = vscode.window.activeTextEditor?.document.uri.fsPath;
            const activeRepo = activeFilePath
               ? gitFolders.find((c) => activeFilePath === c.path || activeFilePath.startsWith(c.path + path.sep))
               : undefined;
            if (activeRepo) {
               targets = [activeRepo];
               log('start: using active editor repo', activeRepo);
            } else {
               logWarn('start: ambiguous — multiple repos, no active editor, no SourceControl');
               vscode.window.showErrorMessage(
                  `Multiple repositories found in this workspace (${gitFolders
                     .map((g) => g.name)
                     .join(', ')}). Open a file inside the target repo, or click the Auto Commit button next to that repo's Source Control panel.`
               );
               setActive(false);
               return;
            }
         }
      }

      stopFlag = false;
      setActive(true);
      vscode.window.showInformationMessage(`Auto Commit Master started — ${targets[0].name}!`);

      let hasErrors = false;
      const totalRepos = targets.length;
      for (let i = 0; i < targets.length; i++) {
         if (stopFlag) {
            logWarn('start: stopFlag set, halting loop', { processedSoFar: i, totalRepos });
            break;
         }
         const gitFolder = targets[i];

         const label = totalRepos > 1 ? `${gitFolder.name} (${i + 1}/${totalRepos})` : gitFolder.name;
         log('start: processing repo', { index: i, totalRepos, name: gitFolder.name, path: gitFolder.path });
         await vscode.window.withProgress(
            {
               location: vscode.ProgressLocation.Notification,
               title: `Auto Commit Master — ${label}`,
               cancellable: false,
            },
            async () => {
               try {
                  const status = await checkGitStatus(gitFolder.path);
                  log('start: status result', { repo: gitFolder.name, status });
                  if (status.error) {
                     hasErrors = true;
                     vscode.window.showErrorMessage(`Error in ${gitFolder.name}: ${status.error}`);
                     return;
                  }
                  if (status.clean) {
                     log('start: repo is clean, skipping', gitFolder.name);
                     return;
                  }
                  await addGitCommits(gitFolder.path);
               } catch (error: any) {
                  hasErrors = true;
                  logError('start: error processing repo', { repo: gitFolder.name, error });
                  vscode.window.showErrorMessage(
                     `Error processing ${gitFolder.name}: ${error?.message ?? String(error)}`
                  );
               }
            }
         );
      }

      if (!stopFlag) {
         setActive(false);
         if (!hasErrors) {
            await sleep(150);
            vscode.window.showInformationMessage(`Files committed in ${targets[0].name}.`);
         }
      } else {
         logWarn('start: finished after stop');
      }
   });

   // -- Stop ------------------------------------------------------------------
   const stop = vscode.commands.registerCommand('auto-commit-master.stop', () => {
      log('stop: command invoked', { stopFlagBefore: stopFlag });
      stopFlag = true;
      setActive(false);
      vscode.window.showInformationMessage('Auto Commit Master stopped!');
   });

   // -- Single-file commit ----------------------------------------------------
   // VS Code invokes this command with different arg shapes depending on
   // which menu fires it:
   //   - context menu (`scm/resourceState/context` group "commit")
   //       → args = (uri: Uri[, uris: Uri[]])
   //   - inline button (`scm/resourceState/context` group "inline")
   //       → args = (scmResourceState: ScmResourceState)
   //     where ScmResourceState has `.resourceUri: Uri` (NOT `.fsPath`)
   // We therefore accept `...args: unknown[]` and walk the args looking for
   // any Uri or ScmResourceState — same pattern GitLens uses.
   const isScmResourceState = (a: unknown): a is vscode.ScmResourceState =>
      !!a && typeof a === 'object' && 'resourceUri' in (a as object) && isUriLike((a as { resourceUri: unknown }).resourceUri);

   const isUriLike = (a: unknown): a is vscode.Uri =>
      a instanceof vscode.Uri ||
      (!!a && typeof a === 'object' && typeof (a as { fsPath?: unknown }).fsPath === 'string');

   const collectUrisFromArgs = (args: unknown[]): vscode.Uri[] => {
      const out: vscode.Uri[] = [];
      const visit = (value: unknown): void => {
         if (value === null || value === undefined) return;
         if (value instanceof vscode.Uri) {
            out.push(value);
            return;
         }
         if (isScmResourceState(value)) {
            out.push(value.resourceUri);
            return;
         }
         if (Array.isArray(value)) {
            for (const item of value) visit(item);
         }
      };
      for (const arg of args) visit(arg);
      return out;
   };

   const commitFile = vscode.commands.registerCommand(
      'auto-commit-master.commitFile',
      async (...args: unknown[]) => {
         log('commitFile: command invoked', { argCount: args.length });
         log(
            'commitFile: arg shapes',
            args.map((a) => {
               if (a === null) return 'null';
               if (a === undefined) return 'undefined';
               if (a instanceof vscode.Uri) return `Uri(${a.fsPath})`;
               if (Array.isArray(a)) return `Array(${a.length})`;
               if (isScmResourceState(a)) {
                  return `ScmResourceState(resourceUri=${(a as vscode.ScmResourceState).resourceUri.fsPath})`;
               }
               if (typeof a === 'object') return `Object(${Object.keys(a as object).slice(0, 6).join(',')})`;
               return typeof a;
            })
         );
         showLogs(true);

         const targets = collectUrisFromArgs(args);
         log('commitFile: extracted targets', { count: targets.length, paths: targets.map((t) => t.fsPath) });

         if (targets.length === 0) {
            logWarn('commitFile: no targets extracted from args');
            vscode.window.showInformationMessage('Select a file in the SCM view to commit.');
            return;
         }

         stopFlag = false;

         let committedCount = 0;
         let skippedCount = 0;
         const skipped: string[] = [];

         for (const fileUri of targets) {
            if (stopFlag) {
               logWarn('commitFile: stopFlag set, halting loop');
               break;
            }

            const filePath = fileUri.fsPath;
            log('commitFile: resolving repo for', filePath);
            const repoPath = findRepoRoot(filePath);
            if (!repoPath) {
               logWarn('commitFile: no repo root found', filePath);
               skipped.push(`${path.basename(filePath)} (not in a git repository)`);
               skippedCount++;
               continue;
            }

            const relativePath = path.relative(repoPath, filePath);
            log('commitFile: resolved paths', { filePath, repoPath, relativePath });

            try {
               const result = await commitSingleFile({
                  repoPath,
                  relativePath,
                  shouldStop: () => stopFlag,
               });
               log('commitFile: result', { filePath, result });
               if (result.committed) {
                  committedCount++;
               } else if (result.reason === 'no-changes') {
                  skipped.push(`${path.basename(filePath)} (no changes)`);
                  skippedCount++;
               }
            } catch (error: any) {
               logError('commitFile: failed', { filePath, repoPath, error });
               vscode.window.showErrorMessage(
                  `Failed to commit ${path.basename(filePath)}: ${error?.message ?? String(error)}`
               );
            }
         }

         if (targets.length === 1) {
            if (committedCount === 1) {
               vscode.window.showInformationMessage('File committed.');
            } else if (skippedCount === 1) {
               vscode.window.showInformationMessage(skipped[0]);
            }
         } else if (committedCount > 0) {
            const skipSuffix = skippedCount > 0 ? `, ${skippedCount} skipped` : '';
            vscode.window.showInformationMessage(
               `Committed ${committedCount} file${committedCount === 1 ? '' : 's'}${skipSuffix}.`
            );
         } else if (skippedCount > 0) {
            vscode.window.showInformationMessage(skipped.join('; '));
         }
      }
   );

   // -- Show logs -------------------------------------------------------------
   const showLogsCommand = vscode.commands.registerCommand('auto-commit-master.showLogs', () => {
      log('showLogs: command invoked');
      showLogs(false);
   });

   context.subscriptions.push(start, stop, commitFile, showLogsCommand);
   setActive(false);
   log('activate: ready');
}

export function deactivate() {
   log('deactivate: extension deactivating');
}
