/** @odoo-module **/

import "account.dashboard.setup.tour";
import { _t } from "web.core";
import { registry } from "@web/core/registry";
import "web.legacy_tranlations_loaded";
import { patch } from "@web/core/utils/patch";

patch(registry.category("web_tour.tours").get("account_render_report"), "patch_account_render_report", {
    steps() {
        const originalSteps = this._super();
        const stepIndex = originalSteps.findIndex((step) => step.id === "account_menu_click");
        originalSteps.splice(stepIndex, 1, {
            trigger: '.o_app[data-menu-xmlid="account_accountant.menu_accounting"]',
            position: 'bottom',
        }, {
            trigger: `a:contains(${_t("Customer Invoices")})`,
        });
        return originalSteps; 
    }
});
