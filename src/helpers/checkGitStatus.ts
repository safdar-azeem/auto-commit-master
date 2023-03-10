import { ChildProcess, spawn } from 'child_process';

interface GitStatus {
    error: string
    message: string
}

export const checkGitStatus = async (): Promise<GitStatus> => {
    const gitStatus: ChildProcess = spawn('git', ['status']);

    return new Promise((resolve, reject) => {
        if (gitStatus.stdout) {
            gitStatus.stdout.on('data', (data) => {
                if (data.toString().includes('nothing to commit, working tree clean')) {
                    resolve({
                        error: '',
                        message: 'All files are committed!'
                    });
                } else {
                    resolve({
                        error: '',
                        message: ''
                    });
                }
            });
        }

        if (gitStatus.stderr) {
            gitStatus.stderr.on('data', (error) => {
                if (error.toString().includes('fatal: not a git repository')) {
                    resolve({
                        error: 'Git is not initialized in this directory!',
                        message: ''
                    });
                } else {
                    resolve({
                        error: '',
                        message: ''
                    });
                }
            });
        }
    });
};
