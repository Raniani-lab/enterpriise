/** @odoo-module */

import { FormController } from '@web/views/form/form_controller';
import { useService } from "@web/core/utils/hooks";


export class FolderFormController extends FormController {
    setup() {
        super.setup();
        this.action = useService("action");
        this.orm = useService("orm");
    }

    /**
     * @override
     */
    async deleteRecord() {
        this.action.doAction("documents.documents_folder_deletion_wizard_action", {
            additionalContext: {
                default_folder_id: this.model.root.resId,
            },
            onClose: async () => {
                const res = await this.orm.searchCount(this.model.root.resModel, [["id", "=", this.model.root.resId]]);
                if (!res) {
                    this.env.config.historyBack();
                }
            }
        });
    }
}
