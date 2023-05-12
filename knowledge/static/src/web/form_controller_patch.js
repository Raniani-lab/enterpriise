/** @odoo-module **/

import core from "web.core";
import { patch } from "@web/core/utils/patch";
import { FormController } from "@web/views/form/form_controller";

patch(FormController.prototype, "knowledge", {
    async onClickSearchKnowledgeArticle() {
        if (this.model.root.isDirty || this.model.root.isNew) {
            const saved = await this.model.root.save({ stayInEdition: true, useSaveErrorDialog: true });
            if (!saved) {
                return;
            }
        }
        core.bus.trigger("openMainPalette", { searchValue: "?" });
    },
});
