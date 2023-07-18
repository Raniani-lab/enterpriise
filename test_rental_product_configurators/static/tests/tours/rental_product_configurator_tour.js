/** @odoo-module **/

import { registry } from "@web/core/registry";
import { stepUtils } from "@web_tour/tour_service/tour_utils";

registry.category("web_tour.tours").add('rental_product_configurator_tour', {
    url: '/web',
    test: true,
    steps: () => [stepUtils.showAppsMenuItem(), {
    trigger: '.o_app[data-menu-xmlid="sale_renting.rental_menu_root"]',
    edition: 'enterprise'
}, {
    trigger: '.o-kanban-button-new',
}, {
    trigger: '.o_required_modifier[name=partner_id] input',
    run: 'text Tajine Saucisse',
}, {
    trigger: '.ui-menu-item > a:contains("Tajine Saucisse")',
    auto: true,
}, {
    trigger: 'a:contains("Add a product")'
}, {
    trigger: 'div[name="product_template_id"] input',
    run: 'text Custom',
}, {
    trigger: 'ul.ui-autocomplete a:contains("Customizable Desk (TEST)")',
},
// Product Configurator Wizard
{
    trigger: 'tr:has(.o_sale_product_configurator_name:contains("Customizable Desk")) label:contains("Steel")',
}, {
    trigger: 'tr:has(.o_sale_product_configurator_name:contains("Customizable Desk")) label:contains("Aluminium")',
}, {
    // Check on the style to ensure that the color is the one set in backend.
    trigger: 'label[style="background-color:#000000"] input'
}, {
    trigger: '.btn-primary:disabled:contains("Confirm")',
    isCheck: true, // check confirm button is disabled
}, {
    // Check on the style to ensure that the color is the one set in backend.
    trigger: 'label[style="background-color:#FFFFFF"] input'
}, {
    trigger: '.btn-primary:not(:disabled):contains("Confirm")',
    isCheck: true, // check confirm is available
}, {
    trigger: 'tr:has(.o_sale_product_configurator_name:contains("Conference Chair")) button:has(i.fa-shopping-cart)',
}, {
    trigger: 'tr:has(.o_sale_product_configurator_name:contains("Chair floor protection")) button:has(i.fa-shopping-cart)',
}, {
    trigger: 'button:contains(Confirm)',
    id: 'quotation_product_selected',
},
// Rental Wizard
{
    trigger: 'button[special=save]',
    extra_trigger: '.o_form_nosheet',
    position: 'bottom',
},

// Editing a custom desk => reopen the rental wizard
{
    trigger: '[name="product_template_id"] span:contains("Customizable Desk (TEST)")',
}, {
    trigger: 'button.fa-calendar',
    extra_trigger: '[data-tooltip*=Customizable]',
},{
    trigger: 'div[name="qty_to_reserve"] input',
    run: 'text 2',
}, {
    trigger: 'div[name="unit_price"] input',
    run: 'text 42',
}, {
    trigger: 'button[special=save]',
    extra_trigger: '.o_form_nosheet',
    position: 'bottom',
}, {
    content: 'Wait for the unit price to be rerendered.',
    trigger: '.o_selected_row [name=price_unit] input:propValue(42.00)',
    run() {},
},

// Adding a line with a more expensive custom desk
{
    trigger: 'a:contains("Add a product")',
}, {
    trigger: 'div[name="product_template_id"] input',
    run: 'text Custom',
}, {
    trigger: 'ul.ui-autocomplete a:contains("Customizable Desk (TEST)")',
},
// Product Configurator Wizard
{
    trigger: 'tr:has(.o_sale_product_configurator_name:contains("Customizable Desk")) label:contains("Steel")',
}, {
    // Check on the style to ensure that the color is the one set in backend.
    trigger: 'label[style="background-color:#FFFFFF"] input'
}, {
    trigger: '.btn-primary:not(:disabled):contains("Confirm")',
    isCheck: true, // check confirm is available
}, {
    trigger: 'button:contains(Confirm)',
    id: 'quotation_product_selected',
},
// Rental Wizard
{
    trigger: 'div[name="qty_to_reserve"] input',
    run: 'text 5',
}, {
    trigger: 'button[special=save]',
    extra_trigger: '.o_form_nosheet',
    position: 'bottom',
}, {
    trigger: 'button[name=action_confirm]',
    position: 'bottom',
}, {
    content: "verify that the rental has been confirmed",
    trigger: '.o_statusbar_status button.o_arrow_button_current:contains("Sales Order")',
    isCheck: true,
}, ...stepUtils.discardForm(),
]});
