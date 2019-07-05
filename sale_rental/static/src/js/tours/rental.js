odoo.define('sale_rental.tour', function (require) {
"use strict";

var core = require('web.core');
var tour = require('web_tour.tour');

var _t = core._t;

tour.register('rental_tour', {
    url: "/web",
}, [tour.STEPS.SHOW_APPS_MENU_ITEM, {
    trigger: '.o_app[data-menu-xmlid="sale_rental.rental_menu_root"]',
    content: _t("Want to <b>rent products</b>? \n Let's discover Odoo Rental App."),
    position: 'bottom',
    edition: 'enterprise'
}, {
    trigger: '.o_menu_header_lvl_1[data-menu-xmlid="sale_rental.menu_rental_products"]',
    content: _t(""),
    position: 'bottom',
}, {
    trigger: '.o_menu_entry_lvl_2[data-menu-xmlid="sale_rental.menu_rental_products_tmpl"]',
    content: _t(""),
    position: 'bottom',
}, {
    trigger: '.o-kanban-button-new',
    extra_trigger: '.breadcrumb-item:contains(Products)',
    content: _t("Create a new Rental Product."),
    position: 'bottom',
}, {
    trigger: "input[name='name']",
    content: _t("Specify the product name."),
    position: 'bottom',
}, {
    trigger: ".nav-item a.nav-link:contains(Rental)",
    content: _t("Specify rental pricings."),
    position: 'bottom',
}, {
    trigger: "a:contains('Add a pricing')",
    content: _t("Create a new Pricing Rule."),
    position: 'bottom',
}, { //TODO add product name
    trigger: '.o_form_button_save',
    content: _t("Save the product."),
    position: 'bottom',
}, {
    trigger: '.o_menu_header_lvl_1[data-menu-xmlid="sale_rental.rental_order_menu"]',
    extra_trigger: '.o_form_button_edit',
    content: _t(""),
    position: 'bottom',
}, {
    trigger: '.o_menu_entry_lvl_2[data-menu-xmlid="sale_rental.rental_orders_all"]',
    content: _t(""),
    position: 'bottom',
}, {
    trigger: '.o-kanban-button-new',
    content: _t("Create a new Rental Quotation."),
    position: 'bottom',
}, {
    trigger: ".o_field_many2one[name=partner_id] input",
    content: _t("Specify the customer."),
    position: 'bottom',
    run: 'text Agrolait',
}, {
    trigger: '.ui-menu-item > a',
    auto: true,
    in_modal: false,
}, {
    trigger: "a:contains('Add a product')",
    content: _t("Create a new Rental Order Line."),
    position: 'bottom',
}, {
    trigger: ".o_field_widget[name=product_id] input, .o_field_widget[name=product_template_id] input",
    content: _t("Specify your rental product."),
    position: 'bottom',
}, {
    trigger: ".ui-menu-item a:contains('Test')",
    auto: true,
}, {
    trigger: "button[special=save]",
    extra_trigger: ".o_form_nosheet",
    content: _t("Specify the rental details. \n When you're done, save the rental line."),
    position: 'bottom',
}, {
    trigger: '.o_form_button_save',
    extra_trigger: '.o_sale_order',
    content: _t("Save the Rental Order."),
    position: 'bottom',
}, {
    trigger: 'button[name=action_confirm]',
    extra_trigger: '.o_form_button_edit',
    content: _t("Confirm the Order."),
    position: 'bottom',
}, {
    trigger: 'button[name=open_pickup]',
    extra_trigger: '.o_sale_order',
    content: _t("Pickup the product."),
    position: 'bottom',
}, {
    trigger: "button[name='apply']",
    content: _t("Confirm the pickup. \n Note that by default, the quantity picked-up is set to the remaining quantity to pickup for easy confirmation."),
    position: 'bottom',
}, {
    trigger: "button[name='open_return']",
    extra_trigger: '.o_sale_order',
    content: _t("Return the product."),
    position: 'bottom',
}, {
    trigger: "button[name='apply']",
    content: _t("Confirm the return."),
    position: 'bottom',
}]);

});
