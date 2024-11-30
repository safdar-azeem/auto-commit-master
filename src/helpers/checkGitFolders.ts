import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export interface GitFolder {
   path: string;
   name: string;
}

export const findGitFolders = async (parentPath: string): Promise<GitFolder[]> => {
   const gitFolders: GitFolder[] = [];

   // Check if the parent folder itself has .git
   if (fs.existsSync(path.join(parentPath, '.git'))) {
      gitFolders.push({
         path: parentPath,
         name: path.basename(parentPath),
      });
      return gitFolders;
   }

   // Check immediate child directories
   try {
      const items = fs.readdirSync(parentPath);
      for (const item of items) {
         const itemPath = path.join(parentPath, item);
         const stat = fs.statSync(itemPath);

         if (stat.isDirectory()) {
            const gitPath = path.join(itemPath, '.git');
            if (fs.existsSync(gitPath)) {
               gitFolders.push({
                  path: itemPath,
                  name: item,
               });
            }
         }
      }
   } catch (error) {
      console.error('Error reading directory:', error);
   }

   return gitFolders;
};
