/** @odoo-module **/

import { registry } from "@web/core/registry";
import tourUtils from '@website_sale/js/tours/tour_utils';

registry.category("web_tour.tours").add('shop_buy_rental_product_comparison', {
    test: true,
    url: '/shop?search=Computer',
    steps: () => [
        {
            content: "click on add to comparison",
            trigger: '.o_add_compare',
        },
        {
            content: "Search Warranty write text",
            trigger: 'form input[name="search"]',
            run: "text Warranty",
        },
        {
            content: "Search Warranty click",
            trigger: 'form:has(input[name="search"]) .oe_search_button',
        },
        {
            content: "add first product 'Warranty' in a comparison list",
            trigger: '.oe_product_cart:contains("Warranty") .o_add_compare',
        },
        {
            content: "check popover is now open and compare button contains two products",
            extra_trigger: '.comparator-popover',
            trigger: '.o_product_circle:contains(2)',
            run: function () {},
        },
        {
            content: "click on compare button",
            trigger: '.o_comparelist_button a',
        },
        {
            content: "click on add to cart",
            trigger: '.product_summary:contains("Computer") .a-submit:contains("Add to Cart")',
        },
        tourUtils.goToCart({quantity: 1}),
        {
            content: "Verify there is a Computer",
            trigger: '#cart_products tbody td.td-product_name a strong:contains("Computer")',
            run: function () {}, // it's a check
        },
        {
            content: "Verify there are 1 quantity of Computers",
            trigger: '#cart_products tbody td.td-qty div.css_quantity input[value=1]',
            run: function () {}, // it's a check
        },
        {
            content: "go to checkout",
            extra_trigger: '#cart_products .oe_currency_value:contains(75.00)',
            trigger: 'a[href*="/shop/checkout"]',
        },
    ]
});