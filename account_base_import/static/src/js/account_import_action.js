/** @odoo-module **/

import { ImportAction } from "@base_import/import_action/import_action";
import { patch } from "@web/core/utils/patch";
import { useService } from "@web/core/utils/hooks";
import { _t } from "@web/core/l10n/translation";

patch(ImportAction.prototype, "account_base_import_patch", {
    setup() {
        this._super();
        this.actionService = useService("action");
    },

    get importOptions() {
        const options = this._super();
        if (this.resModel === "account.move.line") {
            Object.assign(options.name_create_enabled_fields, {
                journal_id: true,
                account_id: true,
                partner_id: true,
            });
        }
        return options;
    },

    exit() {
        if (this.current === "imported" && ["account.move.line", "account.account", "res.partner"].includes(this.resModel)) {
            const names = {
                "account.move.line": _t("Journal Items"),
                "account.account": _t("Chart of Accounts"),
                "res.partner": _t("Customers"),
            }
            const action = {
                name: names[this.resModel],
                res_model: this.resModel,
                type: "ir.actions.act_window",
                views: [[false, "list"], [false, "form"]],
                view_mode: "list",
            }
            if (this.resModel == "account.move.line") {
                action.context = { "search_default_posted": 0 };
            }
            return this.actionService.doAction(action);
        }
        this._super();
    }
});
