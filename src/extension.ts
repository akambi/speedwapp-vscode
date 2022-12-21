// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import { tmpdir } from "os";

function getProjectDirectoryPath(
    sourceUri: vscode.Uri,
    workspaceFolders: readonly vscode.WorkspaceFolder[] = [],
) {
    const possibleWorkspaceFolders = workspaceFolders.filter(
        (workspaceFolder) => {
            return (
                path
                    .dirname(sourceUri.path.toUpperCase())
                    .indexOf(workspaceFolder.uri.path.toUpperCase()) >= 0
            );
        },
    );

    let projectDirectoryPath;
    if (possibleWorkspaceFolders.length) {
      // We pick the workspaceUri that has the longest path
        const workspaceFolder = possibleWorkspaceFolders.sort(
            (x, y) => y.uri.fsPath.length - x.uri.fsPath.length,
        )[0];
        projectDirectoryPath = workspaceFolder.uri.fsPath;
    } else {
        projectDirectoryPath = "";
    }

    return projectDirectoryPath;
}

function createUnsavedFileWithContent(projectDirectory: string, filename: string, content: string) {
    const newFile = vscode.Uri.parse('untitled:' + path.join(projectDirectory, filename));
    vscode.workspace.openTextDocument(newFile).then(document => {
        const edit = new vscode.WorkspaceEdit();
        edit.insert(newFile, new vscode.Position(0, 0), content);
        return vscode.workspace.applyEdit(edit).then(success => {
            if (success) {
                vscode.window.showTextDocument(document);
            } else {
                vscode.window.showInformationMessage('Error!');
            }
        });
    });
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    const openSpeedwapp = (uri?: vscode.Uri, screen: string = 'start') => {
        const isEdit = screen === 'edit';

        let projectDirectory: string = '';
        let sourceUri = uri;
        if (!(sourceUri instanceof vscode.Uri)) {
            if (isEdit && vscode.window.activeTextEditor) {
                // Don't check for HTML files
                sourceUri = vscode.window.activeTextEditor.document.uri;
            }
        }

        let title = 'Speedwapp - New';
        if (sourceUri) {
            if (sourceUri.fsPath) {
                title = `Speedwapp - Edit ${path.basename(sourceUri?.fsPath)}`;
            }
    
            projectDirectory = getProjectDirectoryPath(
                sourceUri,
                vscode.workspace.workspaceFolders,
            ) || path.dirname(sourceUri.fsPath);
        }

        // Create and show a new webview
        const panel = vscode.window.createWebviewPanel(
            'speedwapp', // Identifies the type of the webview. Used internally
            title, // Title of the panel displayed to the user
            vscode.ViewColumn.One, // Editor column to show the new webview panel in.
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                // Only allow the webview to access resources in the specified folders
                localResourceRoots: [
                    vscode.Uri.file(path.join(context.extensionPath)),
                    vscode.Uri.file(tmpdir()),
                    vscode.Uri.file(projectDirectory),
                ]
            }
        );

        const webview = panel.webview;

        let sourceWebviewUriRoot: string = '';
        if (sourceUri) {
            const sourceRoot: vscode.Uri = vscode.Uri.file(
                path.dirname(sourceUri.fsPath)
            );

            sourceWebviewUriRoot = webview.asWebviewUri(sourceRoot).toString();
        }

        if (screen === 'start') {
            panel.webview.html = getWebviewContentForGetStartedPage(webview, context, sourceWebviewUriRoot, title, sourceUri);
        } else {
            const isNew = screen === 'new';
            panel.webview.html = getWebviewContent(webview, context, sourceWebviewUriRoot, title, isNew, sourceUri);
        }

        // Handle messages from the webview
        panel.webview.onDidReceiveMessage(
            message => {
                switch (message.action) {
                    case 'new_with_speedwapp':
                        panel.webview.html = getWebviewContent(webview, context, sourceWebviewUriRoot, title, true, sourceUri);
                        break;
                    case 'save_speedwapp_api_token':
                        context.globalState.update('speedwapp_api_token', message.apiToken);
                        break;
                    case 'copy_codesource_to_workspace':
                        let filename = 'Speedwapp - Unsaved New';
                        if (sourceUri && sourceUri?.fsPath) {
                            const basename = path.basename(sourceUri?.fsPath);
                            filename = `Speedwapp - Unsaved ${basename.replace(/\.[^/.]+$/, "")}`;
                        }

                        if (message.html) {
                            createUnsavedFileWithContent(projectDirectory, `${filename}.html`, message.html);
                        }
                        if (message.js) {
                            createUnsavedFileWithContent(projectDirectory, `${filename}.js`, message.js);
                        }
                        if (message.css) {
                            createUnsavedFileWithContent(projectDirectory, `${filename}.css`, message.css);
                        }
                        break;    
                }
            },
            undefined,
            context.subscriptions
        );
    };

    const newWithSpeedwapp = (uri?: vscode.Uri) => {
        openSpeedwapp(uri, 'new');
    };

    const editWithSpeedwapp = (uri?: vscode.Uri) => {
        openSpeedwapp(uri, 'edit');
    };

    const speedwappExtension = vscode.extensions.getExtension('speedwapp.speedwapp');
    const currentVersion = speedwappExtension!.packageJSON.version ?? "1.0.0";
    const apiToken: string | undefined = context.globalState.get('speedwapp_api_token');
    const lastVersion = context.globalState.get('speedwapp_version');
    if (!apiToken && !lastVersion) {
        void context.globalState.update('speedwapp_version', currentVersion);
        openSpeedwapp();
    }

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with registerCommand
    // The commandId parameter must match the command field in package.json
    context.subscriptions.push(vscode.commands.registerCommand('speedwapp.newWithSpeedwapp', newWithSpeedwapp));
    context.subscriptions.push(vscode.commands.registerCommand('speedwapp.editWithSpeedwapp', editWithSpeedwapp));
}

function getWebviewContentForGetStartedPage( webview: vscode.Webview, context: vscode.ExtensionContext, sourceWebviewUriRoot: string, pageTitle: string, uri?: vscode.Uri ) {
    const isProd = true;
    const speedwappOrigin = isProd ? 'http://speedwapp.com' : 'https://sw-localhost';

    // Get path to resource on disk
    const getStartedCss: vscode.Uri = vscode.Uri.file(
        path.join(context.extensionPath, 'assets', 'speedwapp-get-started.css')
    );

    const getStartedJs: vscode.Uri = vscode.Uri.file(
        path.join(context.extensionPath, 'assets', 'speedwapp-get-started.js')
    );

    const csp = [
        `default-src 'self' ${speedwappOrigin}`,
        `img-src ${`vscode-file://vscode-app`} ${webview.cspSource} https: data: 'self' 'unsafe-inline'`,
        `script-src ${webview.cspSource} https://connect.facebook.net https://platform.twitter.com https://use.fontawesome.com ${speedwappOrigin} https://speedwapp.global.ssl.fastly.net https://code.jquery.com https://ajax.googleapis.com ${isProd ? `` : `https://cdn.jsdelivr.net https://cdn.ckeditor.com`} 'self' 'unsafe-inline' 'unsafe-eval'`,
        `style-src ${webview.cspSource} https: 'self' 'unsafe-inline'`,
        `font-src ${webview.cspSource} https: data:`,
        `frame-src ${webview.cspSource} ${speedwappOrigin} https://www.youtube.com`,
    ];

    return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="${csp.join('; ')}">
            <title>Load Speedwapp editor</title>
            <link href="${webview.asWebviewUri(getStartedCss)}" rel="stylesheet">

        </head>
        <body>
            <div class="sw-getting-started">
                <div class="sw-getting-started-heading">
                    <h1>Welcome to Speedwapp!</h1>
                    <p>Speedwapp is the 1st visual builder for VS Code. It's really easy to use but if you need help, please check out our Getting Started video series on Youtube.</p>
                    <div class="sw-getting-started-actions">
                        <a
                            href="#" onclick="newPage();return false;"
                            class="button button-primary button-hero"
                        >
                            Create Your First Page
                        </a>
                    </div>
                </div>

                <div class="sw-getting-started-how-to-use sw-getting-started-free-ebook">
                    <h2>How to use the extension?</h2>
                    <div class="sw-how-to">
                        <div>
                            <h3>Windows</h3>
                            <ul>
                                <li>To create a new page,<br/> press Ctrl+K then the key N</li>
                                <li>To edit an existing HTML page,<br/> press Ctrl+Shift+V</li>
                            </ul>
                        </div>
                        <div>
                            <h3>Mac</h3>
                            <ul>
                                <li>To create a new page,<br/> press Cmd+K then the key N</li>
                                <li>To edit an existing HTML page,<br/> press Cmd+Shift+V</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
            <script src='${webview.asWebviewUri(getStartedJs)}' id='speedwapp-get-started-js' defer></script>
        </body>
        </html>`;
}

function getWebviewContent( webview: vscode.Webview, context: vscode.ExtensionContext, sourceWebviewUriRoot: string, pageTitle: string, isNew: boolean, uri?: vscode.Uri ) {

    const isDebug = false;
    const isProd = true;
    const speedwappOrigin = isProd ? 'http://speedwapp.com' : 'https://sw-localhost';

    // Get path to resource on disk
    const globalCss: vscode.Uri = vscode.Uri.file(
        path.join(context.extensionPath, 'assets', 'global.css')
    );

    const editorFullscreenJs: vscode.Uri = vscode.Uri.file(
        path.join(context.extensionPath, 'assets', 'speedwapp-editor-full-screen.js')
    );

    const editor: vscode.TextEditor | undefined = vscode.window.activeTextEditor;
    let htmlContent: string;
    if (!isNew && editor) {
        htmlContent = editor.document.getText()?.trim().replace(/\//g, "\\/");
        // it the root is not an HTML Element, wrap in a HTML node
        if (htmlContent && !htmlContent.match(/<[a-z][\s\S]*>/i)) {
            htmlContent = '<p>' + htmlContent + '</p>';
        }
    } else {
        htmlContent = '';
    }

    const csp = [
        `default-src 'self' ${speedwappOrigin}`,
        `img-src ${`vscode-file://vscode-app`} ${webview.cspSource} https: data: 'self' 'unsafe-inline'`,
        `script-src ${webview.cspSource} https://connect.facebook.net https://platform.twitter.com https://use.fontawesome.com ${speedwappOrigin} https://speedwapp.global.ssl.fastly.net https://code.jquery.com https://ajax.googleapis.com ${isProd ? `` : `https://cdn.jsdelivr.net https://cdn.ckeditor.com`} 'self' 'unsafe-inline' 'unsafe-eval'`,
        `style-src ${webview.cspSource} https: 'self' 'unsafe-inline'`,
        `object-src ${webview.cspSource} https: data:`,
        `font-src ${webview.cspSource} https: data:`,
        `frame-src ${webview.cspSource} ${speedwappOrigin} https://www.filepicker.io https://dialog.filepicker.io https://www.facebook.com`,
        `connect-src http://speedwapp.com ${speedwappOrigin} https://furcan.github.io https://github.io https://speedwapp.global.ssl.fastly.net`
    ];

    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <title>Load Speedwapp editor</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="${csp.join('; ')}">
            <link rel="prefetch" href="${speedwappOrigin}${ isDebug? '/app_dev.php' : ''}/embed-js/builder/vscode" as="script">
            <link href="${webview.asWebviewUri(globalCss)}" rel="stylesheet">
        </head>
        <body>
            <div id="speedwapp-editor-container" name="speedwapp-editor"></div>
            <script id='speedwapp-editor-full-screen-js-before' type="text/javascript">
                ( function( pageData ) {
                    // Print speedwapp config
                    document.write('<input name="speedwapp-editor-content" type="hidden" id="speedwapp-editor-content" />' );
                    document.getElementById('speedwapp-editor-content').value = JSON.stringify( pageData );
                } )( \`${htmlContent}\` );

                var editorLoaderTemplate = \`
                    <!DOCTYPE html>
                    <html lang="en">
                    <head>
                        <title>Load Speedwapp editor</title>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <link href="${webview.asWebviewUri(globalCss)}" rel="stylesheet">
                        <script type="text/javascript" src="${speedwappOrigin}${ isDebug? '/app_dev.php' : ''}/embed-js/builder/vscode"><\\/script>
                    </head>
                    <body>
                        <div class="sw-editor-div-container">
                        </div>
                    </body>
                    </html>
                \`;

                var SpeedwappSettings = {
                    "speedwapp_api_token": "${context.globalState.get('speedwapp_api_token', '')}",
                    "host": "${sourceWebviewUriRoot}",
                    "page_title": "${pageTitle}",
                };
            </script>
            <script src='${webview.asWebviewUri(editorFullscreenJs)}' id='speedwapp-editor-full-screen-js' defer></script>
        </body>
        </html>
    `;
}

// this method is called when your extension is deactivated
export function deactivate() {}