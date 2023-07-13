/** @odoo-module **/
import { registry } from "@web/core/registry";
registry.category("web_tour.tours").add('l10n_mx_edi_pos.tour_invoice_order', {
    test: true,
    steps: () => [
    {
        content: "Click the POS icon",
        trigger: ".o_app[data-menu-xmlid='point_of_sale.menu_point_root']",
    },
    {
        content: "Open POS session from backend",
        trigger: "button[name='open_ui']",
    },
    {
        content: "Open POS session popup",
        trigger: "div.button:contains('Open session')",
    },
    {
        content: "Select a product",
        trigger: "div.product-content:contains('Acoustic Bloc Screens')",
    },
    {
        content: "go to Payment",
        trigger: ".pay-order-button",
    },
    {
        content: "Customer wants an invoice",
        trigger: ".js_invoice",
    },
    {
        content: "Set Usage: 'General Expenses'",
        trigger: "select[name='l10n_mx_edi_usage']",
        run: 'text G03',
    },
    {
        content: "Set Invoice to Public: 'Yes'",
        trigger: "select[name='l10n_mx_edi_cfdi_to_public']",
        run: 'text 1',
    },
    {
        content: "Confirm and close the popup",
        trigger: ".button.confirm",
    },
    {
        content: "Open the list of customers",
        trigger: "span:contains('Customer')",
    },
    {
        content: "Open the details for the first customer",
        trigger: "button.edit-partner-button:first",
    },
    {
        content: "Set the country as Mexico",
        trigger: "select[name='country_id']",
        run: 'text Mexico',
    },
    {
        content: "Set the fiscal regime as 'Consolidación'",
        trigger: "select[name='l10n_mx_edi_fiscal_regime']",
        run: 'text 609',
    },
    {
        content: "Check the No Tax Breakdown checkbox",
        trigger: "input[name='l10n_mx_edi_no_tax_breakdown']",
    },
]});
