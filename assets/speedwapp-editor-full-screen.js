( function( $ ) {

    const vscode = acquireVsCodeApi();
    // Data used by speedwapp widget (editor)
    window.speedwapp_api_token = SpeedwappSettings.speedwapp_api_token;

    function ajaxReturn(urlTo, datas, successFun) {
        var response = '';
        successFun(response);
    }

    var speedwappEditor = {
        win: null,
        editorContent: null,

        editorLoaded: function() {
            this.$swEditorContainer.removeClass('speedwapp-loading');
        },

        initialize: function() {
            this.$swEditorContent = $('#speedwapp-editor-content');
            this.$swEditorContainer = $('#speedwapp-editor-container');
            this.$swEditor = this.$swEditorContainer.find('#speedwapp-editor');
            this.$swEditorContainer.addClass('speedwapp-loading');

            this.initEditorContent();

            // Switch to the Speedwapp editor
            if (window.addEventListener) {
                addEventListener("message", this.listener.bind(this), false);
            } else {
                attachEvent("onmessage", this.listener.bind(this));
            }
        },

        setupEditorEvent: function() {
            this.$previewButton.off('click');
            this.$previewButton.on('click', function(event) {
                event.preventDefault();
                speedwappEditor.win.postMessage({
                    data_type: 'preview_post'
                }, SpeedwappSettings.wpurl);
                return false;
            });

            this.$publishingButton.off('click');
            this.$publishingButton.on('click', function(event) {
                event.preventDefault();
                speedwappEditor.win.postMessage({
                    data_type: 'save_post'
                }, SpeedwappSettings.wpurl);
            });            
        },
        /**
         * Handle displaying the builder
         */
        initEditorContent: function () {
            var editorContent = this.$swEditorContent.val();

            if (!editorContent) {
                return;
            }

            var htmlTag = editorContent.match(/<[a-z][\s\S]*>/i);
            if (htmlTag) {
                this.editorContent = editorContent;
            } else {
                // if not HTML, wrap in a HTML node
                this.editorContent = '<div>'+editorContent+'</div>';
            }
        },
        listener: function (event) {
//            if (!event || !event.source || event.source.app_domain !== 'https://speedwapp.com') {
            if (!event || !event.source || event.source.app_domain !== 'https://sw-localhost') {
                    return;
            }

        //    if (!speedwappEditor.win) {
                speedwappEditor.win = event.source;
        //    }

            var self = this;
            console.log('widget_check', speedwappEditor.win, event.data.type);

            switch (event.data.type) {
                case 'child_ready':
                    break;
                case 'widget_check':
                    speedwappEditor.win.postMessage({
                        data_type: 'widget_info',
                        value: 'vscode',
                        data: {
                            postId: SpeedwappSettings.post_id,
                            pageOrigin: SpeedwappSettings.page_origin,
                            pageBaseHref: SpeedwappSettings.host,
                        }
                    }, SpeedwappSettings.wpurl);
                    break;
                case 'widget_export':
                    const exportConfig = {
                        url: event.data.url,
                        passcode: event.data.passcode,
                        published: event.data.published,
                    };

                    if(SpeedwappSettings.post_id) {
                        exportConfig.action = 'save_swapp_zip';
                        exportConfig.postId = SpeedwappSettings.post_id;
                    } else {
                        exportConfig.action = 'download_swapp_zip';
                    }

                    ajaxReturn('', exportConfig, function (response, status) {
                        speedwappEditor.win.postMessage({
                            data_type: 'widget_export_success',
                            value: {
                                http_code: status,
                            }
                        }, SpeedwappSettings.wpurl);
                    });

                    break;
                case 'reload_iframe':
                    if (newFrame && onFrameLoadedSw) {
                        frameLoad();
                    }
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
                        speedwappEditor.win.postMessage({
                            data_type: 'load_json',
                                value: {
                                    content: SpeedwappSettings.post_json_data, data: {
                                    pageTitle: SpeedwappSettings.page_title
                                }
                            }

                        }, SpeedwappSettings.wpurl);
                    } else if (this.editorContent) {
                        speedwappEditor.win.postMessage({
                            data_type: 'load_theme',
                                value: {
                                    content: this.editorContent , data: {
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
                    this.editorLoaded();
                    break;
                case 'init_widget_finish':
                    break;
            }
        }
    };

    $( document ).ready(function() {
        speedwappEditor.initialize();
    });

}( window.jQuery ));
