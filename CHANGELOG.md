# Change Log

All notable changes to the "auto-commit-master" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

### Fixed

- **Inline per-file commit button silently did nothing.** VS Code invokes commands contributed to `scm/resourceState/context` with two different arg shapes: the right-click context menu passes `(uri: Uri)`, but the inline group (`group: "inline"`) passes `(scmResourceState: ScmResourceState)`. The old code assumed the first arg was a `Uri`, so the inline-button path got an `ScmResourceState` object whose `fsPath` is `undefined`, and the commit silently no-op'd. The command now walks the args looking for either a `Uri` or a `ScmResourceState` and unwraps `state.resourceUri` when needed. A new diagnostic log line (`commitFile: arg shapes`) makes the shape VS Code actually passed obvious from the Output panel.

### Added

- **Inline commit-file button on every SCM row.** The `auto-commit-master.commitFile` command is now also contributed with `group: "inline"` to `scm/resourceState/context` and `scm/resourceFolder/context`, which puts a small `$(git-commit)` icon next to each file in the Source Control panel (Changes, Staged Changes, Merge Changes, etc.). One click → commit only that file, in the right repository, with correct per-file history. The right-click "Auto Commit Master: Commit File" entry remains as a fallback for keyboard / context-menu users.

### Fixed

- **Multi-project start button now commits only in the clicked repo.** The Start button in the SCM title bar appears once per repository in a multi-project workspace (e.g. `erp-new/erp-api`, `erp-new/erp-storage`, `erp-new/erp-web`). When invoked from one of those panels, VS Code passes the matching `SourceControl` instance to the command, and the extension now uses `SourceControl.rootUri` to scope the commit to that single repository. There is no picker — clicking the button next to `erp-api` only ever touches `erp-api`. A new `Auto Commit Master: Show Logs` command and `autoCommitMaster.verbose` setting make the per-step flow easy to inspect in the Output panel.
- Per-repo progress notifications and stop-on-error handling retained for the now-single-repo path.

## [0.1.0]

### Added

- **Commit a single file on demand.** New command `Auto Commit Master: Commit File` is available from the SCM resource context menu (right-click a changed file in the Source Control panel), the SCM resource folder context menu, and the editor title bar context menu. The command auto-detects which repository the file belongs to, classifies the change (new / modified / deleted) using `git status --porcelain`, and creates exactly one commit for that file. Per-commit history and timestamps are preserved because each invocation is its own `git commit` transaction.
- **Multi-root workspace support.** `auto-commit-master.start` now iterates every `workspaceFolders` entry instead of only the first one.

### Fixed

- **Multi-project workspace scoping.** Previously, when a workspace contained sibling git repositories (e.g. `parent/projectA` and `parent/projectB` inside the same parent folder), committing in one project could affect the others. The root cause was a combination of `process.chdir()` mutating global state and a too-eager early-return in `findGitFolders` that ignored sibling repos when the parent itself had a `.git` marker. All git invocations now use the `cwd` option on `spawn` (no global chdir), and the repository discovery logic correctly prefers sibling sub-repos over a parent repo to avoid double-committing submodule pointers.
- **Silent file loss in `getFiles`.** The previous implementation only captured the first stdout chunk per command, so repos with many changed files could silently lose entries. The new implementation buffers stdout and parses on process close.
- All git invocations now pass the file path after `--` to avoid filename-as-flag injection, and pass an explicit `cwd` so they are safe under any process state.

### Changed

- Bulk commit (`auto-commit-master.start`) now shows per-repo progress notifications when the workspace contains more than one repository.
- Bulk commit no longer calls `addGitCommits` three times per repo (a leftover hack that doubled I/O without effect).
- Internal helper `runGitCommand` has been replaced by `runGit` / `runGitCapture`, which take an explicit `cwd` and surface non-zero exit codes with stderr to the caller.

## [0.0.4]

- Initial release
