export const generateCommitMessage = (file: string, prefix?: string): string => {
    const fileName = file.split('/').pop()?.replace(/^[_\-\/]+/, "");
    return `${prefix} ${fileName}`;
};