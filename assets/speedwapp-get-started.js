const vscode = acquireVsCodeApi();

function newPage() {
    vscode.postMessage({
        action: 'new_with_speedwapp'
    });
}
