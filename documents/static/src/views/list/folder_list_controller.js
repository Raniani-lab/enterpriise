/** @odoo-module */

import { ListController } from '@web/views/list/list_controller';
import { useService } from "@web/core/utils/hooks";


export class FolderListController extends ListController {
    setup() {
        super.setup();
        this.action = useService("action");
    }

    onDeleteSelectedRecords() {
        const selection = this.model.root.selection;
        if(selection.length > 1) {
            return super.onDeleteSelectedRecords(...arguments);
        }
        this.action.doAction("documents.documents_folder_deletion_wizard_action", {
            additionalContext: {
                default_folder_id: selection[0].resId,
            },
            onClose: async () => {
                await this.model.load();
            }
        });
    }
}
