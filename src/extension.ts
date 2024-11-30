import * as vscode from 'vscode';
import { getFiles } from './helpers/getListOfFiles';
import { runGitCommand } from './helpers/runGitCommand';
import { checkGitStatus } from './helpers/checkGitStatus';
import { generateCommitMessage } from './helpers/generateCommitMessage';
import { findGitFolders, GitFolder } from './helpers/checkGitFolders';

let stopFlag = false;

const addGitCommits = async (workingDirectory: string) => {
   const files = await getFiles();
   const { newFiles, modifiedFiles, deletedFiles } = files;

   // Process deleted files first
   for (const file of deletedFiles) {
      if (stopFlag) return;
      const message = generateCommitMessage(file, 'Delete');
      await runGitCommand('git', ['rm', file]);
      await runGitCommand('git', ['commit', '-m', message]);
   }

   // Process modified files second
   for (const file of modifiedFiles) {
      if (stopFlag) return;
      const message = generateCommitMessage(file, 'Update');
      await runGitCommand('git', ['add', file]);
      await runGitCommand('git', ['commit', '-m', message]);
   }

   // Process new files last
   for (const file of newFiles) {
      if (stopFlag) return;
      const message = generateCommitMessage(file, 'Add');
      await runGitCommand('git', ['add', file]);
      await runGitCommand('git', ['commit', '-m', message]);
   }
};

export function activate(context: vscode.ExtensionContext) {
   let start = vscode.commands.registerCommand('auto-commit-master.start', async () => {
      const workspacePath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
      if (!workspacePath) {
         vscode.window.showErrorMessage('No workspace folder is opened');
         return vscode.commands.executeCommand('setContext', 'autoCommitMaster.active', false);
      }

      const gitFolders = await findGitFolders(workspacePath);

      if (gitFolders.length === 0) {
         vscode.window.showErrorMessage(
            'No Git repositories found in the workspace or its immediate subfolders'
         );
         return vscode.commands.executeCommand('setContext', 'autoCommitMaster.active', false);
      }

      stopFlag = false;
      vscode.commands.executeCommand('setContext', 'autoCommitMaster.active', true);
      vscode.window.showInformationMessage('Auto Commit Master started!');

      let hasErrors = false;
      for (const gitFolder of gitFolders) {
         if (stopFlag) break;

         process.chdir(gitFolder.path);
         const status = await checkGitStatus();

         if (status.error) {
            hasErrors = true;
            vscode.window.showErrorMessage(`Error in ${gitFolder.name}: ${status.error}`);
            continue;
         }

         if (!status.message) {
            try {
               await addGitCommits(gitFolder.path);
               await addGitCommits(gitFolder.path);
               await addGitCommits(gitFolder.path);
            } catch (error: any) {
               hasErrors = true;
               vscode.window.showErrorMessage(`Error processing ${gitFolder.name}: ${error.message}`);
            }
         }
      }

      if (!stopFlag) {
         vscode.commands.executeCommand('setContext', 'autoCommitMaster.active', false);
         if (!hasErrors) {
            vscode.window.showInformationMessage('All files are committed!');
         }
      }
   });

   let stop = vscode.commands.registerCommand('auto-commit-master.stop', () => {
      stopFlag = true;
      vscode.commands.executeCommand('setContext', 'autoCommitMaster.active', false);
      vscode.window.showInformationMessage('Auto Commit Master stopped!');
   });

   context.subscriptions.push(start, stop);
   vscode.commands.executeCommand('setContext', 'autoCommitMaster.active', false);
}

export function deactivate() {}
