/** @odoo-module **/

import { registry } from "@web/core/registry";
import tourUtils from '@website_sale/js/tours/tour_utils';

registry.category("web_tour.tours").add('shop_sale_giftcard', {
    test: true,
    url: '/shop?search=Accoustic',
    steps: () => [
        {
            content: "select Small Cabinet",
            trigger: '.oe_product a:contains("Acoustic Bloc Screens")',
        },
        {
            content: "add 1 Small Cabinet into cart",
            trigger: '#product_details input[name="add_qty"]',
            run: "text 1",
        },
        {
            content: "click on 'Add to Cart' button",
            trigger: "a:contains(ADD TO CART)",
        },
        tourUtils.goToCart(1),
        {
            content: "go to checkout",
            trigger: 'a[href="/shop/checkout?express=1"]',
            run: 'click'
        },
        {
            content: "click on 'Pay with gift card'",
            trigger: '.show_coupon',
            extra_trigger: 'button[name="o_payment_submit_button"]',
            run: 'click'
        },
        {
            content: "Enter gift card code",
            trigger: "input[name='promo']",
            run: 'text 123456'
        },
        {
            content: "click on 'Pay'",
            trigger: "button[type='submit'].a-submit:contains(Pay)",
            run: 'click'
        },
        {
            content: "check total amount of order",
            trigger: "#order_total .oe_currency_value:contains(0.00)",
        },
    ]
});
