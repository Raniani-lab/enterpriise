/** @odoo-module **/

/**
 * The purpose of this class is to hold any information that other components may use to re render,
 *  such as which folders are currently being uploaded into
 */

let uploadIdSequence = 0;

export class DocumentsUploadStore {
    constructor() {
        this.currentUploads = {};
        this.uploadingFolderIds = new Set();
        this.uploadByRecordId = {};
    }

    setController(controller) {
        this.controller = controller;
    }

    get model() {
        return this.controller.model;
    }

    _refreshUploadingFolderIds() {
        const uploadingFolderIds = new Set();
        const uploadByRecordId = {};
        for (const upload of Object.values(this.currentUploads)) {
            if (upload.folderId) {
                uploadingFolderIds.add(upload.folderId);
            }
            if (upload.recordId) {
                uploadByRecordId[upload.recordId] = upload;
            }
        }
        this.uploadingFolderIds = uploadingFolderIds;
        this.uploadByRecordId = uploadByRecordId;
    }

    isUploadingInFolder(folderId) {
        return this.uploadingFolderIds.has(folderId);
    }

    getFileUploadForRecord(recordId) {
        return this.uploadByRecordId[recordId];
    }

    addNewUpload(fileUpload) {
        const uploadId = ++uploadIdSequence;
        fileUpload.uploadId = uploadId;
        this.currentUploads[uploadId] = fileUpload;
        this._refreshUploadingFolderIds();
        return uploadId;
    }

    removeUpload(uploadId) {
        delete this.currentUploads[uploadId];
        this._refreshUploadingFolderIds();
    }
}
