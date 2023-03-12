import { spawn, ChildProcess } from 'child_process';

export const runGitCommand = (command: string, args: string[]): Promise<void> => {
    return new Promise((resolve, reject) => {
        const child: ChildProcess = spawn(command, args);
        child.on('close', (code: number) => {
            resolve();
        });
    });
};