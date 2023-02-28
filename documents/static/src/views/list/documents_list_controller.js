/** @odoo-module **/

import { ListController } from "@web/views/list/list_controller";

import { preSuperSetup, useDocumentView } from "@documents/views/hooks";

export class DocumentsListController extends ListController {
    setup() {
        preSuperSetup();
        super.setup(...arguments);
        const properties = useDocumentView(this.documentsViewHelpers());
        Object.assign(this, properties);
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
        };
    }
}

DocumentsListController.template = "documents.DocumentsListController";
