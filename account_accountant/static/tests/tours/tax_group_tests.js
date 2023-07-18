/** @odoo-module */

import "account.tax.group.tour.tests"
import { registry } from "@web/core/registry";
import { patch } from "@web/core/utils/patch";

patch(registry.category("web_tour.tours").get("account_tax_group"), "patch_account_tax_group", {
    steps() {
        const originalSteps = this._super();
        const accountMenuClickIndex = originalSteps.findIndex((step) => step.id === 'account_menu_click');
        originalSteps.splice(accountMenuClickIndex, 1, 
            {
                trigger: '.o_app[data-menu-xmlid="account_accountant.menu_accounting"]',
                content: "Go to Accounting",
            }
        );
        return originalSteps;
    }
});
