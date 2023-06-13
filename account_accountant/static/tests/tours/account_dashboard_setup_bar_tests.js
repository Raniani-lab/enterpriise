/** @odoo-module **/

import "account.dashboard.setup.tour";
import { _t } from "web.core";
import { registry } from "@web/core/registry";
import "web.legacy_tranlations_loaded";

const { steps } = registry.category("web_tour.tours").get("account_render_report");
const accountMenuClickIndex = steps.findIndex(step => step.id === 'account_menu_click');

steps.splice(accountMenuClickIndex, 1, {
    trigger: '.o_app[data-menu-xmlid="account_accountant.menu_accounting"]',
    position: 'bottom',
}, {
    trigger: `a:contains(${_t("Customer Invoices")})`,
});
