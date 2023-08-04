/** @odoo-module **/

import "@account/../tests/tours/account_dashboard_setup_bar_tests";
import { _t } from "@web/core/l10n/translation";
import { registry } from "@web/core/registry";
import { patch } from "@web/core/utils/patch";

patch(registry.category("web_tour.tours").get("account_render_report"), {
    steps() {
        const originalSteps = super.steps();
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
