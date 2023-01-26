odoo.define('account_accountant.dashboard.setup.tour', function (require) {
"use strict";

require('account.dashboard.setup.tour');
const { _t } = require('web.core');
const { registry } = require("@web/core/registry");

const { steps } = registry.category("web_tour.tours").get("account_render_report");
const accountMenuClickIndex = steps.findIndex(step => step.id === 'account_menu_click');

steps.splice(accountMenuClickIndex, 1, {
    trigger: '.o_app[data-menu-xmlid="account_accountant.menu_accounting"]',
    position: 'bottom',
}, {
    trigger: `a:contains(${_t("Customer Invoices")})`,
});

});
