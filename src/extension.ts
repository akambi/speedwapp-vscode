// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import { tmpdir } from "os";
import { basename } from 'path';

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

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    const editWithSpeedwapp = (uri?: vscode.Uri) => {

        let resource = uri;
        if (!(resource instanceof vscode.Uri)) {
            if (vscode.window.activeTextEditor) {
                // we are relaxed and don't check for markdown files
                resource = vscode.window.activeTextEditor.document.uri;
            }
        }

        let title = 'Speedwapp - New';
        if (resource && resource?.fsPath) {
            title = `Speedwapp - Edit ${path.basename(resource?.fsPath)}`;
        }

        const sourceUri = resource;
        let projectDirectory: string = '';
        if (sourceUri) {
            projectDirectory = getProjectDirectoryPath(
                sourceUri,
                vscode.workspace.workspaceFolders,
            ) || path.dirname(sourceUri.fsPath);
        }

        // The code you place here will be executed every time your command is executed
        // Create and show a new webview
        const panel = vscode.window.createWebviewPanel(
            'speedwapp', // Identifies the type of the webview. Used internally
            title, // Title of the panel displayed to the user
            vscode.ViewColumn.One, // Editor column to show the new webview panel in.
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                // Only allow the webview to access resources in our extension's media directory
                localResourceRoots: [
                    vscode.Uri.file(path.join(context.extensionPath)),
                    vscode.Uri.file(tmpdir()),
                    vscode.Uri.file(projectDirectory),
                ]
            }
        );

        const webview = panel.webview;

        let sourceWebviewUriRoot: string = '';
        if (resource) {
            const sourceRoot: vscode.Uri = vscode.Uri.file(
                path.dirname(resource.fsPath)
            );

            sourceWebviewUriRoot = webview.asWebviewUri(sourceRoot).toString();
            console.log('resourceBBBB', sourceWebviewUriRoot);
        }

        panel.webview.html = getWebviewContent(webview, context, sourceWebviewUriRoot, resource);

        // Handle messages from the webview
        panel.webview.onDidReceiveMessage(
            message => {
                switch (message.action) {
                    case 'save_speedwapp_api_token':
                        context.globalState.update('speedwapp_api_token', message.apiToken);
                        break;
                    case 'copy_codesource_to_workspace':
                        let filename = 'Speedwapp - Unsaved New';
                        if (resource && resource?.fsPath) {
                            const basename = path.basename(resource?.fsPath);
                            filename = `Speedwapp - Unsaved ${basename.replace(/\.[^/.]+$/, "")}`;
                            console.info('basename', filename, basename);
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


    // The command has been defined in the package.json file
    // Now provide the implementation of the command with registerCommand
    // The commandId parameter must match the command field in package.json
    let disposable = vscode.commands.registerCommand('speedwapp.editWithSpeedwapp', editWithSpeedwapp);

    context.subscriptions.push(disposable);
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

function getWebviewContent( webview: vscode.Webview, context: vscode.ExtensionContext, sourceWebviewUriRoot: string, uri?: vscode.Uri ) {

    const isProd = false;

    // Get path to resource on disk
    const globalCss: vscode.Uri = vscode.Uri.file(
        path.join(context.extensionPath, 'assets', 'global.css')
    );

    const speedwappServiceWorker: vscode.Uri = vscode.Uri.file(
        path.join(context.extensionPath, 'assets', 'speedwapp-service-worker.js')
    );

    const editorFullscreenJs: vscode.Uri = vscode.Uri.file(
        path.join(context.extensionPath, 'assets', 'speedwapp-editor-full-screen.js')
    );

    let resource = uri;
    if (!(resource instanceof vscode.Uri)) {
      if (vscode.window.activeTextEditor) {
        // we are relaxed and don't check for markdown files
        resource = vscode.window.activeTextEditor.document.uri;
      }
    }

    const editor: vscode.TextEditor | undefined = vscode.window.activeTextEditor;
    const htmlContent = editor?.document.getText();
    //.replace(/[\\$"']/g, "\\$&");

    console.log('textinEditorAAA', webview);
    console.log('textinEditorLanguage', editor?.document.languageId);
      
    const csp = [
        `default-src 'none';`,
        `img-src ${`vscode-file://vscode-app`} ${webview.cspSource} https: data: 'self' 'unsafe-inline'`,
        `script-src ${webview.cspSource} https://connect.facebook.net https://platform.twitter.com https://use.fontawesome.com  https://speedwapp.com https://speedwapp.global.ssl.fastly.net https://code.jquery.com https://ajax.googleapis.com ${isProd ? `` : `https://sw-localhost https://cdn.jsdelivr.net https://cdn.ckeditor.com`} 'self' 'unsafe-inline' 'unsafe-eval'`,
        `style-src ${webview.cspSource} https: 'self' 'unsafe-inline'`,
        `object-src ${webview.cspSource} https: data:`,
        `font-src ${webview.cspSource} https: data:`,
        `frame-src ${webview.cspSource} https://www.filepicker.io https://dialog.filepicker.io https://www.facebook.com`,
        `connect-src http://speedwapp.com https://speedwapp.com https://furcan.github.io https://github.io ${isProd ? `https://speedwapp.global.ssl.fastly.net` : `https://ajax.googleapis.com https://sw-localhost https://speedwapp.global.ssl.fastly.net`}`
    ];

    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <title>Load Speedwapp editor</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="${csp.join('; ')}">
            <link href="${webview.asWebviewUri(globalCss)}" rel="stylesheet">
        </head>
        <body>
            <div id="speedwapp-editor-container" name="speedwapp-editor">
            </div>
            <input
                name="speedwapp-tab-name"
                type="hidden"
                id="speedwapp-tab-name"
                value="Speedwapp"
            />

            <script type="text/javascript">
                ( function( pageData ) {
                    // Print speedwapp config
                    document.write('<input name="speedwapp-editor-content" type="hidden" id="speedwapp-editor-content" />' );
                    document.getElementById('speedwapp-editor-content').value = JSON.stringify( pageData );
                } )( \`${htmlContent?.trim().replace(/\//g, "\\/")}\` );
            </script>

            <script id='speedwapp-editor-full-screen-js-before'>
                const searchParams = new URL(location.toString()).searchParams;
                const ID = searchParams.get('id');
                const webviewOrigin = searchParams.get('origin');
                const onElectron = searchParams.get('platform') === 'electron';
                const expectedWorkerVersion = parseInt(searchParams.get('swVersion'));

                var urlParts = window.location.href.split('/index.html');
                var vsCodeServiceWorker = '';
                var pageOrigin = '';
                if (urlParts.length) {
                    vsCodeServiceWorker = urlParts[0] + '/service-worker.js?v=' + expectedWorkerVersion + '&vscode-resource-base-authority=vscode-resource.vscode-cdn.net&remoteAuthority=';
                    pageOrigin = './fake.html?id=' + ID;
                }

                let newFrame;
                const createIframe = () => {
                    const currentFrame = document.createElement('iframe');
                    currentFrame.setAttribute('id', 'speedwapp-editor');
                    currentFrame.setAttribute('name', 'speedwapp-editor');
                    currentFrame.setAttribute('frameborder', '0');
                    currentFrame.setAttribute('data-mode', 'post');
                    currentFrame.setAttribute('class', 'speedwapp-editor');
    
                    // We should just be able to use srcdoc, but I wasn't
                    // seeing the service worker applying properly.
                    // Fake load an empty on the correct origin and then write real html
                    // into it to get around this.
                    currentFrame.src = './fake.html?id=' + ID;
    
                    currentFrame.style.cssText = 'margin: 0; overflow: hidden; width: 100%; height: 100%;';
                    document.getElementById('speedwapp-editor-container').appendChild(currentFrame);
                    console.log('editorContainer', document.getElementById('speedwapp-editor-container'), currentFrame);
                    return currentFrame;
                } 

                const newDocument = '<!DOCTYPE html>\
                    <html lang="en">\
                    <head>\
                        <title>Load Speedwapp editor</title>\
                        <meta charset="UTF-8">\
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">\
                        <link href="${webview.asWebviewUri(globalCss)}" rel="stylesheet">\
                        <script type="text/javascript" src="https://sw-localhost/app_dev.php/embed-js/builder/vscode"><\\/script>\
                    </head>\
                    <body>\
                        <div class="sw-editor-div-container">\
                        </div>\
                    </body>\
                    </html>';

                /**
                 * @param {Document} contentDocument
                 */
                function onFrameLoadedSw(contentDocument) {
                    // Workaround for https://bugs.chromium.org/p/chromium/issues/detail?id=978325
                    setTimeout(() => {
                        contentDocument.open();
                        contentDocument.write(newDocument);
                        contentDocument.close();
                    }, 0);
                }
                
                const onDomContentLoaded = e => {
                    const contentDocument = e.target ? (/** @type {HTMLDocument} */ (e.target)) : undefined;
                    console.log('contentDocument', contentDocument);
                    if (contentDocument) {          
                        onFrameLoadedSw(contentDocument);
                    }
                };

                function frameLoad() {
                    // your code goes here
                    console.log('Refresh iframe');

                    if (newFrame) {
                        newFrame.contentWindow.$ = undefined;
                        newFrame.contentWindow.jQuery = undefined;                        
                        newFrame.contentWindow.removeEventListener('DOMContentLoaded', onDomContentLoaded);
                        newFrame.parentNode.removeChild(newFrame);
                    }

                    // create a new frame.
                    newFrame = createIframe();
                    console.log('iframejquery0000', newFrame.contentWindow);
                    if (newFrame && newFrame.contentWindow) {
                        newFrame.contentWindow.addEventListener('DOMContentLoaded', onDomContentLoaded);
                    }
                }

                frameLoad();

                var SpeedwappSettings = {
                    "fullscreen":true,
                    "host": "${sourceWebviewUriRoot}",
                    "page_origin": pageOrigin,
                    "speedwapp_api_token": "${context.globalState.get('speedwapp_api_token', '')}",
                    "page_title":"Speedwapp #652",
                };

            </script>
            <script src='https://ajax.googleapis.com/ajax/libs/jquery/1.10.2/jquery.min.js' id='jquery-js'></script>
            <script src='${webview.asWebviewUri(editorFullscreenJs)}' id='speedwapp-editor-full-screen-js'></script>
        </body>
        </html>
    `;
}

// this method is called when your extension is deactivated
export function deactivate() {}
