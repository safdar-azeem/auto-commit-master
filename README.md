# Auto Commit Master Extension

The Auto Commit Master extension for Visual Studio Code automates the process of committing changes to Git repositories. It commits each file as its own commit (so history stays clean and timestamps are correct), supports per-file commits via an inline button, and is safe to use in workspaces that contain multiple git repositories side by side — clicking the button next to one project's panel only ever touches that project.

> Don't forget to follow me on [GitHub](https://github.com/safdar-azeem)!

![Preview of the Auto Commit Master extension](/images/preview.gif)

# Features

- **Per-file automatic committing.** New, modified, and deleted files are added (or removed) and committed as **separate commits** — one commit per file.

- **Auto-generated commit messages.** The message is built from the file name and its status: `Add` for new files, `Update` for modifications, `Delete` for removals.

- **Inline commit button on every file row.** Each file in the Source Control panel gets a small commit icon. One click → commit only that file. The right-click "Auto Commit Master: Commit File" entry is also available as a keyboard / context-menu fallback.

- **Multi-project workspace support.** When two or more git repositories are opened inside the same parent folder, the Start button appears once per repository and each click is scoped to that project only. Changes in one project never affect another.

- **Per-repo progress notifications.** Progress is shown for the project being processed; clean projects are silently skipped.

- **Stop button.** Halt an in-flight bulk commit cleanly between file transactions.

- **Activity log.** Every step is logged to a dedicated **Auto Commit Master** Output channel (`View → Output → Auto Commit Master`). Enable `autoCommitMaster.verbose` in settings to get detailed per-file and per-git-command logs when something doesn't behave the way you expect.

# Usage

- Open Visual Studio Code and make sure you have a Git repository initialized in your workspace.
- Open the Git source control panel from the activity bar on the sidebar.

### Bulk: Start button <img src="images/png/start.png" alt="Start icon" width="20" height="18">

- In the source control panel, click the **Auto Commit Message** button at the top of the panel for the project you want to commit in.
- That project is committed — every changed file inside it, one commit per file.
- If the workspace contains multiple git projects, the button appears once per project in its own panel. Each click is scoped to that project only.
- Click the **Stop** button to halt the process mid-flight.

### Single file: inline button

- In the Source Control panel, find the file you want to commit.
- Click the small commit icon that appears next to it.
- That file alone is committed. The repository the file belongs to is detected automatically, so this works correctly even when the file is inside a sub-project of a larger workspace.

### Single file: context menu

- In the Source Control panel, right-click a single changed file.
- Pick **Auto Commit Master: Commit File**.

### Activity log

- Open the command palette and run **Auto Commit Master: Show Logs**, or pick **View → Output → Auto Commit Master** from the menu.
- The log auto-opens whenever you run a command, so you can watch the flow in real time.

# Settings

| Setting                    | Default | Description                                                                                               |
| -------------------------- | ------- | --------------------------------------------------------------------------------------------------------- |
| `autoCommitMaster.verbose` | `false` | Enable detailed per-file and per-git-command logging. Useful when investigating "why didn't this commit?" |

# Notes

- Commit messages are generated from the file name only. If you need a custom message, edit the commit after the fact or open a feature request.
- The extension uses `git` from your `PATH`. Make sure `git` is installed and configured with a user name and email.
- The inline commit button is enabled for **all** SCM groups (Changes, Staged Changes, Merge Changes, etc.). If a file is already staged and you click the inline button, it will be re-staged (idempotent) and committed with the auto-generated message. To preserve a custom staged intent, use VS Code's regular Commit button instead.

## Author

[safdar-azeem](https://github.com/safdar-azeem)

## License

MIT
