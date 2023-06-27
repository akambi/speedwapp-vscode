/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ([
/* 0 */,
/* 1 */
/***/ ((module) => {

module.exports = require("vscode");

/***/ }),
/* 2 */
/***/ ((module) => {

module.exports = require("path");

/***/ }),
/* 3 */
/***/ ((module) => {

module.exports = require("os");

/***/ })
/******/ 	]);
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be isolated against other modules in the chunk.
(() => {
var exports = __webpack_exports__;

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.deactivate = exports.activate = void 0;
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = __webpack_require__(1);
const path = __webpack_require__(2);
const os_1 = __webpack_require__(3);
function getProjectDirectoryPath(sourceUri, workspaceFolders = []) {
    const possibleWorkspaceFolders = workspaceFolders.filter((workspaceFolder) => {
        return (path
            .dirname(sourceUri.path.toUpperCase())
            .indexOf(workspaceFolder.uri.path.toUpperCase()) >= 0);
    });
    let projectDirectoryPath;
    if (possibleWorkspaceFolders.length) {
        // We pick the workspaceUri that has the longest path
        const workspaceFolder = possibleWorkspaceFolders.sort((x, y) => y.uri.fsPath.length - x.uri.fsPath.length)[0];
        projectDirectoryPath = workspaceFolder.uri.fsPath;
    }
    else {
        projectDirectoryPath = "";
    }
    return projectDirectoryPath;
}
function createUnsavedFileWithContent(projectDirectory, filename, content) {
    const newFile = vscode.Uri.parse('untitled:' + path.join(projectDirectory, filename));
    vscode.workspace.openTextDocument(newFile).then(document => {
        const edit = new vscode.WorkspaceEdit();
        edit.insert(newFile, new vscode.Position(0, 0), content);
        return vscode.workspace.applyEdit(edit).then(success => {
            if (success) {
                vscode.window.showTextDocument(document);
            }
            else {
                vscode.window.showInformationMessage('Error!');
            }
        });
    });
}
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
function activate(context) {
    const editWithSpeedwapp = (uri, isNew = false) => {
        // The code you place here will be executed every time your command is executed
        let projectDirectory = '';
        let sourceUri = uri;
        if (!(sourceUri instanceof vscode.Uri)) {
            if (!isNew && vscode.window.activeTextEditor) {
                // Don't check for HTML files
                sourceUri = vscode.window.activeTextEditor.document.uri;
            }
        }
        let title = 'Speedwapp - New';
        if (sourceUri) {
            if (sourceUri.fsPath) {
                title = `Speedwapp - Edit ${path.basename(sourceUri?.fsPath)}`;
            }
            projectDirectory = getProjectDirectoryPath(sourceUri, vscode.workspace.workspaceFolders) || path.dirname(sourceUri.fsPath);
        }
        // Create and show a new webview
        const panel = vscode.window.createWebviewPanel('speedwapp', // Identifies the type of the webview. Used internally
        title, // Title of the panel displayed to the user
        vscode.ViewColumn.One, // Editor column to show the new webview panel in.
        {
            enableScripts: true,
            retainContextWhenHidden: true,
            // Only allow the webview to access resources in the specified folders
            localResourceRoots: [
                vscode.Uri.file(path.join(context.extensionPath)),
                vscode.Uri.file((0, os_1.tmpdir)()),
                vscode.Uri.file(projectDirectory),
            ]
        });
        const webview = panel.webview;
        let sourceWebviewUriRoot = '';
        if (sourceUri) {
            const sourceRoot = vscode.Uri.file(path.dirname(sourceUri.fsPath));
            sourceWebviewUriRoot = webview.asWebviewUri(sourceRoot).toString();
        }
        panel.webview.html = getWebviewContent(webview, context, sourceWebviewUriRoot, title, isNew, sourceUri);
        // Handle messages from the webview
        panel.webview.onDidReceiveMessage(message => {
            switch (message.action) {
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
                case "openExternalLink":
                    vscode.env.openExternal(vscode.Uri.parse(message.link));
                break;
            }
        }, undefined, context.subscriptions);
    };
    const newWithSpeedwapp = (uri) => {
        editWithSpeedwapp(uri, true);
    };
    // The command has been defined in the package.json file
    // Now provide the implementation of the command with registerCommand
    // The commandId parameter must match the command field in package.json
    context.subscriptions.push(vscode.commands.registerCommand('speedwapp.newWithSpeedwapp', newWithSpeedwapp));
    context.subscriptions.push(vscode.commands.registerCommand('speedwapp.editWithSpeedwapp', editWithSpeedwapp));
}
exports.activate = activate;
function getWebviewContent(webview, context, sourceWebviewUriRoot, pageTitle, isNew, uri) {
    const isDebug = true;
    const isProd = false;
    const speedwappOrigin = isProd ? 'http://speedwapp.com' : 'https://sw-localhost';
    // Get path to resource on disk
    const globalCss = vscode.Uri.file(path.join(context.extensionPath, 'assets', 'global.css'));
    const editorFullscreenJs = vscode.Uri.file(path.join(context.extensionPath, 'assets', 'speedwapp-editor-full-screen.js'));
    const editor = vscode.window.activeTextEditor;
    let htmlContent;
    if (!isNew && editor) {
        htmlContent = editor.document.getText()?.trim().replace(/\//g, "\\/");
        // it the root is not an HTML Element, wrap in a HTML node
        if (htmlContent && !htmlContent.match(/<[a-z][\s\S]*>/i)) {
            htmlContent = '<p>' + htmlContent + '</p>';
        }
    }
    else {
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
            <link rel="prefetch" href="${speedwappOrigin}${isDebug ? '/app_dev.php' : ''}/embed-js/builder/vscode" as="script">
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
                        <script type="text/javascript" src="${speedwappOrigin}${isDebug ? '/app_dev.php' : ''}/embed-js/builder/vscode"><\\/script>
                    </head>
                    <body>
                        <div class="sw-editor-div-container">
                        </div>
                    </body>
                    </html>
                \`;

                var SpeedwappSettings = {
                    "speedwapp_api_token": "",
//                    "speedwapp_api_token": "${context.globalState.get('speedwapp_api_token', '')}",
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
function deactivate() { }
exports.deactivate = deactivate;

})();

module.exports = __webpack_exports__;
/******/ })()
;
//# sourceMappingURL=extension.js.map