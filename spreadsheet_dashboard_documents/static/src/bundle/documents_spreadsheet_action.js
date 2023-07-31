/** @odoo-module **/

import { SpreadsheetAction } from "@documents_spreadsheet/bundle/actions/spreadsheet_action";
import * as spreadsheet from "@odoo/o-spreadsheet";
import { _t } from "@web/core/l10n/translation";
import { patch } from "@web/core/utils/patch";
const { topbarMenuRegistry } = spreadsheet.registries;
import { useSubEnv } from "@odoo/owl";

topbarMenuRegistry.addChild("add_document_to_dashboard", ["file"], {
    name: _t("Add to dashboard"),
    sequence: 200,
    isVisible: (env) => env.canAddDocumentAsDashboard,
    execute: (env) => env.createDashboardFromDocument(env.model),
    icon: "o-spreadsheet-Icon.ADD_TO_DASHBOARD",
});

/** @typedef {import("@spreadsheet/o_spreadsheet/o_spreadsheet").Model} Model */

patch(SpreadsheetAction.prototype, "spreadsheet_dashboard_documents.SpreadsheetAction", {
    setup() {
        this._super();
        useSubEnv({
            canAddDocumentAsDashboard: true,
            createDashboardFromDocument: this._createDashboardFromDocument.bind(this),
        });
    },

    /**
     * @param {Model} model
     * @private
     */
    async _createDashboardFromDocument(model) {
        const resId = this.resId;
        const name = this.state.spreadsheetName;
        await this.env.services.orm.write("documents.document", [resId], {
            spreadsheet_data: JSON.stringify(model.exportData()),
        });
        this.env.services.action.doAction(
            {
                name: this.env._t("Name your dashboard and select its section"),
                type: "ir.actions.act_window",
                view_mode: "form",
                views: [[false, "form"]],
                target: "new",
                res_model: "spreadsheet.document.to.dashboard",
            },
            {
                additionalContext: {
                    default_document_id: resId,
                    default_name: name,
                },
            }
        );
    },
});
