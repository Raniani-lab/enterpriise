/** @odoo-module **/

import { _t } from "web.core";
import { sprintf } from "@web/core/utils/strings";
import { useService } from "@web/core/utils/hooks";
import { ConfirmationDialog } from "@web/core/confirmation_dialog/confirmation_dialog";

const { Component, useState } = owl;

// Progress Bar component
export class DocumentsFileUploadProgressBar extends Component {
    setup() {
        this.state = useState(this.props.fileUpload);
        this.dialogService = useService("dialog");
    }

    onCancel() {
        if (!this.state.xhr) {
            return;
        }
        this.dialogService.add(ConfirmationDialog, {
            body: sprintf(_t("Do you really want to cancel the upload of %s?"), this.state.title),
            confirm: () => {
                this.state.xhr.abort();
            },
        });
    }
}

DocumentsFileUploadProgressBar.template = "documents.DocumentsFileUploadProgressBar";

// Progress Card - Base
export class DocumentsFileUploadViewRecord extends Component {
    setup() {
        this.state = useState(this.props.fileUpload);
    }

    getProgressTexts() {
        const percent = Math.round(this.state.progress * 100);
        if (percent === 100) {
            return {
                left: _t("Processing..."),
                right: "",
            };
        } else {
            const mbLoaded = Math.round(this.state.loaded / 1000000);
            const mbTotal = Math.round(this.state.total / 1000000);
            return {
                left: sprintf(_t("Uploading... (%s%)"), percent),
                right: sprintf(_t("(%s/%sMB)"), mbLoaded, mbTotal),
            };
        }
    }
}

DocumentsFileUploadViewRecord.components = {
    DocumentsFileUploadProgressBar,
};
DocumentsFileUploadViewRecord.template = "documents.DocumentsFileUploadViewRecord";

export class DocumentsFileUploadViewContainer extends Component {
    setup() {
        this.documentsState = useState(this.env.documentsStore);
    }

    /**
     * Returns all the "new documents" uploads
     */
    getCurrentUploads() {
        const currentFolder = this.env.searchModel.getSelectedFolderId();
        let uploads = Object.values(this.documentsState.currentUploads);
        if (this.props.filterOutRecordUploads) {
            uploads = Object.values(this.documentsState.currentUploads).filter((upload) => !upload.recordId);
        }
        if (currentFolder) {
            uploads = uploads.filter((upload) => upload.folderId === currentFolder);
        }
        return uploads;
    }
}

DocumentsFileUploadViewContainer.components = {
    DocumentsFileUploadViewRecord,
};
DocumentsFileUploadViewContainer.template = "documents.DocumentsFileUploadViewContainer";
