/** @odoo-module **/

import { ActivityController } from "@mail/views/activity/activity_controller";

import { preSuperSetup, useDocumentView } from "@documents/views/hooks";

export class DocumentsActivityController extends ActivityController {
    setup() {
        preSuperSetup();
        super.setup(...arguments);
        const properties = useDocumentView({
            getSelectedDocumentsElements: () => [],
            isRecordPreviewable: this.isRecordPreviewable.bind(this),
        });
        Object.assign(this, properties);
    }

    /**
     * Select record for inspector.
     *
     * @override
     */
    async openRecord(record, mode) {
        for (const record of this.model.root.selection) {
            record.selected = false;
        }
        record.selected = true;
        this.model.notify();
    }

    /**
     * @returns {Boolean} whether the record can be previewed in the attachment viewer.
     */
    isRecordPreviewable(record) {
        return this.model.activityData.activity_res_ids.includes(record.resId);
    }

    /**
     * @override
     * @param {number} [templateID]
     * @param {number} [activityTypeID]
     */
    sendMailTemplate(templateID, activityTypeID) {
        super.sendMailTemplate(templateID, activityTypeID);
        this.env.services.notification.add(this.env._t("Reminder emails have been sent."), {type: "success"});
    }

}
DocumentsActivityController.template = "documents.DocumentsActivityController";
