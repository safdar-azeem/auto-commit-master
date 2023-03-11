import { spawn, ChildProcess } from 'child_process';

export interface GitFiles {
    newFiles: string[];
    modifiedFiles: string[];
    deletedFiles: string[];
}

export const getFiles = async (): Promise<GitFiles> => {
    const commands: Record<string, [string, string[]]> = {
        newFiles: ['git', ['ls-files', '--others', '--exclude-standard']],
        modifiedFiles: ['git', ['ls-files', '--modified', '--exclude-standard']],
        deletedFiles: ['git', ['ls-files', '--deleted']],
    };

    const files: GitFiles = {
        newFiles: [],
        modifiedFiles: [],
        deletedFiles: [],
    };

    const promises: Promise<void>[] = [];
    for (const key in commands) {
        const command = commands[key];
        const promise = new Promise<void>((resolve, reject) => {
            const child: ChildProcess = spawn(command[0], command[1]);
            child.stdout?.on('data', (data: Buffer) => {
                if (files[key as keyof GitFiles].length === 0) {
                    const filesData: string[] = data.toString().trim().split('\n');
                    console.log(`filesData ${key}`, filesData)
                    files[key as keyof GitFiles] = filesData;
                }
            });
            child.on('close', (code: number) => {
                if (code !== 0) {
                    reject(new Error('Git command failed'));
                } else {
                    resolve();
                }
            });
        });
        promises.push(promise);
    }

    await Promise.all(promises);

    files.modifiedFiles = files.modifiedFiles.filter(
        (file) => !files.deletedFiles.includes(file)
    );

    return files;
};

