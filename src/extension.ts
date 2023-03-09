import * as vscode from 'vscode';
import { getFiles } from './helpers/getListOfFiles';
import { runGitCommand } from './helpers/runGitCommand';
import { checkGitStatus } from './helpers/checkGitStatus';
import { generateCommitMessage } from './helpers/generateCommitMessage';

let stopFlag = false;

const addGitCommits = async () => {
	const files = await getFiles();
	const { newFiles, modifiedFiles, deletedFiles } = files;

	const allFiles = [
		...newFiles.map(file => ({ file, action: 'Add' })),
		...modifiedFiles.map(file => ({ file, action: 'Update' })),
		...deletedFiles.map(file => ({ file, action: 'Delete' }))
	];

	for (const { file, action } of allFiles) {
		if (stopFlag) {
			return;
		}
		const message = generateCommitMessage(file, action);
		if (action === 'Delete') {
			await runGitCommand('git', ['rm', file]);
		} else {
			await runGitCommand('git', ['add', file]);
		}
		await runGitCommand('git', ['commit', '-m', message]);
	}
};

export function activate(context: vscode.ExtensionContext) {
	let start = vscode.commands.registerCommand('auto-commit-master.start', async () => {

		process.chdir(vscode.workspace.workspaceFolders?.[0].uri.fsPath ?? "");

		const status = await checkGitStatus()

		if (status.error) {
			vscode.window.showErrorMessage(status.error);
			return vscode.commands.executeCommand('setContext', 'autoCommitMaster.active', false);
		} else if (status.message) {
			vscode.window.showInformationMessage(status.message);
			return vscode.commands.executeCommand('setContext', 'autoCommitMaster.active', false);
		}

		stopFlag = false;
		vscode.commands.executeCommand('setContext', 'autoCommitMaster.active', true);
		vscode.window.showInformationMessage('Auto Commit Master started!');

		await addGitCommits();
		await addGitCommits();
		await addGitCommits();

		if (!stopFlag) {
			vscode.window.showInformationMessage('All files are committed!');
			vscode.commands.executeCommand('setContext', 'autoCommitMaster.active', false);
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

export function deactivate() { }
