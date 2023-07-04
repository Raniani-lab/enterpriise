/** @odoo-module **/

import { useService } from "@web/core/utils/hooks";
import { patch } from "@web/core/utils/patch";
import { FormController } from "@web/views/form/form_controller";

patch(FormController.prototype, {
    setup() {
        super.setup();
        this.command = useService("command");
    },

    async onClickSearchKnowledgeArticle() {
        if (this.model.root.isDirty || this.model.root.isNew) {
            const saved = await this.model.root.save({ stayInEdition: true, useSaveErrorDialog: true });
            if (!saved) {
                return;
            }
        }
        this.command.openMainPalette({ searchValue: "?" });
    },
});
