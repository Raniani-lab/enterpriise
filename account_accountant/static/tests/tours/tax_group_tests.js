/** @odoo-module */

import "account.tax.group.tour.tests"
import { registry } from "@web/core/registry";

const { steps } = registry.category("web_tour.tours").get("account_tax_group");

const accountMenuClickIndex = steps.findIndex(step => step.id === 'account_menu_click');

steps.splice(accountMenuClickIndex, 1, 
    {
        trigger: '.o_app[data-menu-xmlid="account_accountant.menu_accounting"]',
        content: "Go to Accounting",
    }
);
