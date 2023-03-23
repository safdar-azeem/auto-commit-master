# Auto Commit Master Extension

The Auto Commit Master extension for Visual Studio Code automates the process of committing changes to Git repositories. Instead of manually committing each file, this extension automatically adds and commits files with appropriate commit messages.

# Features

![Preview of the Auto Commit Master extension](/images/preview.gif)

The Auto Commit Master extension offers the following features:

-  Automatic Committing: The extension automatically adds and commits new files to the Git repository. It eliminates the need for manual committing of individual files.

-  Commit Message Generation: The extension generates commit messages for each file based on its name and status. It prefixes the commit message with either `Add` or `Update` to indicate whether the file is new or modified, respectively.

-  Deletion Handling: If a file is deleted, the extension detects it and creates a commit with a `Delete` message.

-  Stop Functionality: The extension provides a stop command that allows users to halt the automatic commit process.

# Usage

-  Open Visual Studio Code.
-  Make sure you have a Git repository initialized in your workspace.
-  Open the Git source control panel by clicking on the Git icon in the activity bar on the sidebar.

### Start button <img src="images/png/start.png" alt="SVG Image" width="20" height="18">

-  In the source control panel of top, click on the "Commit" icon button to start the automatic commit process.
-  The Auto Commit Master will start automatically committing files in the background

### Stop button <img src="images/png/stop.png" alt="SVG Image" width="20" height="20">

-  while the extension is running, you can click on the "Stop" icon button to stop the automatic commit process.
