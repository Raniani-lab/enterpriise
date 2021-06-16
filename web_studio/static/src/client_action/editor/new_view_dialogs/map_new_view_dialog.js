/** @odoo-module */
import { NewViewDialog } from "@web_studio/client_action/editor/new_view_dialogs/new_view_dialog";

export class MapNewViewDialog extends NewViewDialog {
    setup() {
        super.setup();
        this.bodyTemplate = "web_studio.MapNewViewFieldsSelector";
    }

    get viewType() {
        return "map";
    }

    computeSpecificFields(fields) {
        this.partnerFields = fields.filter(
            (field) => field.type === "many2one" && field.relation === "res.partner"
        );
        if (!this.partnerFields.length) {
            // TODO: dialof Alert
        }
    }
}
