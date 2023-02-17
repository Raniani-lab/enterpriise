/** @odoo-module **/

import { cartHandlerMixin } from '@website_sale/js/website_sale_utils';

const OldaddToCartInPage = cartHandlerMixin._addToCartInPage;

/**
 * @private
 * 
 * Override to disable the datimepicker as soon as rental product is added to cart.
 */
cartHandlerMixin._addToCartInPage = async function (params) {
    const data = await OldaddToCartInPage.apply(this, arguments);
    if (data.line_id && params.start_date) {
        document.querySelector("input[name=renting_dates]").disabled = true;
    }
    return data;
};
