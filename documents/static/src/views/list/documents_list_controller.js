/** @odoo-module **/

import { ListController } from "@web/views/list/list_controller";

import { preSuperSetup, useDocumentView } from "@documents/views/hooks";
import { useState } from "@odoo/owl";

export class DocumentsListController extends ListController {
    setup() {
        preSuperSetup();
        super.setup(...arguments);
        const properties = useDocumentView(this.documentsViewHelpers());
        Object.assign(this, properties);

        this.documentStates = useState({
            inspectedDocuments: [],
            previewStore: {},
        });
    }

    get modelParams() {
        const modelParams = super.modelParams;
        modelParams.multiEdit = true;
        return modelParams;
    }

    onWillSaveMultiRecords() {}

    onSavedMultiRecords() {}

    /**
     * Override this to add view options.
     */
    documentsViewHelpers() {
        return {
            getSelectedDocumentsElements: () =>
                this.root.el.querySelectorAll(
                    ".o_data_row.o_data_row_selected .o_list_record_selector"
                ),
            setInspectedDocuments: (inspectedDocuments) => {
                this.documentStates.inspectedDocuments = inspectedDocuments;
            },
            setPreviewStore: (previewStore) => {
                this.documentStates.previewStore = previewStore;
            },
        };
    }
}

DocumentsListController.template = "documents.DocumentsListController";
