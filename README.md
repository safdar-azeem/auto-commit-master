# Auto Commit Master Extension

The Auto Commit Master extension for Visual Studio Code automates the process of committing changes to Git repositories. Instead of manually committing each file, this extension automatically adds and commits files with appropriate commit messages — file by file — and is safe to use in workspaces that contain multiple git repositories side by side.

# Features

![Preview of the Auto Commit Master extension](/images/preview.gif)

-  **Automatic Committing (per-file):** The extension automatically adds and commits new, modified, and deleted files in the Git repository as **separate commits** — one commit per file, so history stays clean and timestamps are correct.

-  **Commit Message Generation:** Commit messages are generated per file from the file name and status. The prefix is `Add` for new files, `Update` for modifications, and `Delete` for removals.

-  **Single-File Commit on Demand:** Right-click a changed file in the Source Control panel and pick **Auto Commit Master: Commit File** to commit only that file. The command auto-detects which repository the file belongs to, so it works correctly even in multi-project workspaces.

-  **Multi-Project Workspaces:** When two or more git repositories are opened inside the same parent folder (or as multiple workspace folders in VS Code), commits are scoped to the active repository. Changes in one project never affect another.

-  **Stop Functionality:** A stop command halts the automatic commit process mid-flight.

# Usage

-  Open Visual Studio Code.
-  Make sure you have a Git repository initialized in your workspace.
-  Open the Git source control panel by clicking on the Git icon in the activity bar on the sidebar.

### Bulk: Start button <img src="images/png/start.png" alt="Start icon" width="20" height="18">

-  In the source control panel, click the **Auto Commit Message** button at the top to start the automatic commit process.
-  The extension walks every git repository in the workspace (including sibling sub-repos inside a parent folder) and commits each changed file separately, in order. When more than one repository is present, per-repo progress is shown.
-  Click the **Stop** button to halt the process.

### Single file: context menu

-  In the Source Control panel, right-click a single changed file.
-  Pick **Auto Commit Master: Commit File**.
-  That file is staged (or removed) and committed as its own commit. The repository the file belongs to is detected automatically by walking up the directory tree to the nearest `.git` folder, so this works correctly even when the file is inside a sub-project of a larger workspace.

# Notes

-  Commit messages are generated from the file name only (e.g. `Update helpers/runGit.ts`). If you need a custom message, edit the commit after the fact or open a feature request.
-  The extension uses `git` from your `PATH`. Make sure `git` is installed and configured with a user name and email.
-  For multi-project workspaces, the extension never mutates the global working directory; every git command is scoped to the relevant repository.
