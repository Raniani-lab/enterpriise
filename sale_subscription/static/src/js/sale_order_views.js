odoo.define('sale_subscription.SaleOrderView', function (require) {
    "use strict";

    const SaleOrderFormController = require('sale_subscription.SaleOrderFormController');
    const FormView = require('sale.SaleOrderView');
    const viewRegistry = require('web.view_registry');

    const SaleOrderView = FormView.extend({
        config: _.extend({}, FormView.prototype.config, {
            Controller: SaleOrderFormController,
        }),
    });

    viewRegistry.add('sale_subscription_form', SaleOrderView);

    return SaleOrderView;

});
