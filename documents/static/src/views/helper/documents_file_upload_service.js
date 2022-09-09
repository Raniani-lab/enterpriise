/** @odoo-module **/

import { registry } from "@web/core/registry";
import { csrf_token, _t } from "web.core";
import { sprintf } from "@web/core/utils/strings";
import { useBus } from "@web/core/utils/hooks";

const { reactive, useComponent } = owl;

export const documentsFileUploadService = {
    /**
     * Used to be able to create a mocked version in the tests.
     *
     * @private
     * @returns {XMLHttpRequest}
     */
    _createXhr() {
        return new window.XMLHttpRequest();
    },

    start(env) {
        /**
         * @param {string} route
         * @param {FileList} files
         * @param {Integer} recordId
         * @param {DocumentsUploadStore} documentsStore
         * @param {Object} context
         * @param {Function} params.onLoaded
         * @param {Function} params.onProgress
         * @param {Function} params.onError
         * @param {Array[Integer]} params.tagIds
         * @returns {reactive} a reactive object containing information about the upload
         */
        const add = async (route, files, folderId, recordId = false, documentsStore, context = {}, params = {}) => {
            const xhr = this._createXhr();
            xhr.open("POST", route);
            const upload = reactive({
                recordId,
                folderId,
                xhr,
                title: files.length === 1 ? files[0].name : sprintf(_t("%s Files"), files.length),
                type: files.length === 1 ? files[0].type : undefined,
                progress: 0,
                loaded: 0,
                total: 0,
            });
            const formData = new FormData();
            formData.append("csrf_token", csrf_token);
            if (recordId) {
                formData.append("document_id", recordId);
            }
            formData.append("folder_id", folderId);
            if (params.tagIds) {
                formData.append("tag_ids", params.tagIds);
            }
            for (const file of files) {
                formData.append("ufile", file);
            }
            if (context) {
                for (const key of ["default_owner_id", "default_partner_id", "default_res_id", "default_res_model"]) {
                    if (context[key]) {
                        formData.append(key.replace("default_", ""), context[key]);
                    }
                }
            }
            let uploadId = documentsStore && documentsStore.addNewUpload(upload);
            xhr.upload.addEventListener("progress", async (ev) => {
                upload.progress = ev.loaded / ev.total;
                upload.loaded = ev.loaded;
                upload.total = ev.total;
                if (params.onProgress) {
                    await params.onProgress(ev);
                }
            });
            xhr.onload = async () => {
                // const result = xhr.status === 200 ? JSON.parse(xhr.response) : {error: true, status: xhr.status, response: xhr.response};
                const result =
                    xhr.status === 200
                        ? JSON.parse(xhr.response)
                        : {
                              error: sprintf(_t("status code: %s, message: %s"), xhr.status, xhr.response),
                          };
                if (documentsStore && uploadId) {
                    documentsStore.removeUpload(uploadId);
                }
                await params.onLoaded(result);
            };
            xhr.onerror = async () => {
                if (documentsStore && uploadId) {
                    documentsStore.removeUpload(uploadId);
                }
                if (params.onError) {
                    const result = {
                        error: _t("An error occured while uploading."),
                        status: xhr.status,
                        response: xhr.responseText,
                    };
                    await params.onError(result);
                }
            };
            xhr.onabort = async () => {
                if (documentsStore && uploadId) {
                    documentsStore.removeUpload(uploadId);
                }
                if (params.onError) {
                    const result = { abort: true };
                    await params.onError(result);
                }
            };
            xhr.send(formData);
            // Notify the necessary records about the new change.
            if (recordId) {
                env.bus.trigger("document-new-upload", {
                    recordId,
                });
            }
            return upload;
        };
        return { add };
    },
};

export function useFileUpload(recordId) {
    const component = useComponent();
    const env = component.env;
    useBus(env.bus, "document-new-upload", (ev) => {
        if (ev.detail.recordId === recordId) {
            component.render(true);
        }
    });
}

registry.category("services").add("documents_file_upload", documentsFileUploadService);
