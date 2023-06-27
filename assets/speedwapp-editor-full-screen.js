( function() {

    const vscode = acquireVsCodeApi();
    // Data used by speedwapp widget (editor)
    window.speedwapp_api_token = SpeedwappSettings.speedwapp_api_token;

    const editorContainer = document.getElementById('speedwapp-editor-container');
    const searchParams = new URL(location.toString()).searchParams;
    const ID = searchParams.get('id');

    const urlParts = window.location.href.split('/index.html');
    const pageOrigin = urlParts.length ? './fake.html?id=' + ID : '';

    const editorContentElement = document.querySelector('#speedwapp-editor-content');
    editorContainer.classList.add('speedwapp-loading');

    let newFrame;
    let editorContent = null;

    const onDomContentLoaded = e => {
        const contentDocument = e.target ? (/** @type {HTMLDocument} */ (e.target)) : undefined;
        if (contentDocument) {
            // Workaround for https://bugs.chromium.org/p/chromium/issues/detail?id=978325
            setTimeout(() => {
                contentDocument.open();
                contentDocument.write(editorLoaderTemplate);
                contentDocument.close();
            }, 0);
        }
    };

    const createEditorIframe = () => {
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

        editorContainer.appendChild(currentFrame);

        return currentFrame;
    };

    const loadEditorIframe = () => {
        if (newFrame) {
            newFrame.contentWindow.removeEventListener('DOMContentLoaded', onDomContentLoaded);
            newFrame.parentNode.removeChild(newFrame);
        }

        // create a new frame.
        newFrame = createEditorIframe();
        if (newFrame && newFrame.contentWindow) {
            newFrame.contentWindow.addEventListener('DOMContentLoaded', onDomContentLoaded);
        }
    };

    const initEditorContent = () => {
        editorContent = editorContentElement.value;

        if (!editorContent) {
            return;
        }
    };

    const messageListener = (event) => {
        // if (!event || !event.source || event.source.app_domain !== 'https://speedwapp.com') {
        if (!event || !event.source || event.source.app_domain !== 'https://sw-localhost') {
                return;
        }

        switch (event.data.type) {
            case 'widget_check':
                event.source.postMessage({
                    data_type: 'widget_info',
                    value: 'vscode',
                    data: {
                        pageOrigin,
                        pageBaseHref: SpeedwappSettings.host,
                    }
                }, SpeedwappSettings.wpurl);
                break;
            case 'reload_iframe':
                loadEditorIframe();
                break;
            case 'copy_codes_to_workspace':
                vscode.postMessage({
                    action: 'copy_codesource_to_workspace',
                    html: event.data.html,
                    js: event.data.js,
                    css: event.data.css,
                });
                break;
            case 'send_user_wp':
                vscode.postMessage({
                    action: 'save_speedwapp_api_token',
                    apiToken: event.data.apiToken,
                });
                break;
            case 'manager_ready':
                if (SpeedwappSettings.post_json_data) {
                    event.source.postMessage({
                        data_type: 'load_json',
                            value: {
                                content: SpeedwappSettings.post_json_data, data: {
                                pageTitle: SpeedwappSettings.page_title
                            }
                        }

                    }, SpeedwappSettings.wpurl);
                } else if (editorContent) {
                    event.source.postMessage({
                        data_type: 'load_theme',
                            value: {
                                content: editorContent , data: {
                                    url: SpeedwappSettings.host,
                                    pageTitle: SpeedwappSettings.page_title
                                }
                            }
                        },
                        SpeedwappSettings.wpurl
                    );
                }
                break;
            case 'speedwapp_editor_ready':
                // Editor is Loaded
                editorContainer.classList.remove('speedwapp-loading');
                break;
            case 'init_widget_finish':
                break;
            case 'openExternalLink':
                vscode.postMessage({
                    action: 'openExternalLink',
                    link: event.data.link,
                });
                break;
        }
    }

    const initialize = () => {
        initEditorContent();
        loadEditorIframe();

        if (window.addEventListener) {
            addEventListener("message", messageListener, false);
        } else {
            attachEvent("onmessage", messageListener);
        }
    };

    document.addEventListener("DOMContentLoaded", function() {
        initialize();
    });
}());