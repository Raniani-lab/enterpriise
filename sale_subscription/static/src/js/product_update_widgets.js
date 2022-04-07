odoo.define('sale_subscription.subscription_widgets', function (require) {
    "use strict";

    const SaleorderLineMixin = require('sale.UpdateAllLinesMixin');
    const FieldsRegistry = require('web.field_registry');
    const BasicFields = require('web.basic_fields');
    const field_utils = require('web.field_utils');
    const FieldMany2One = require('web.relational_fields').FieldMany2One;

    const ProductUpdateDateWidget = BasicFields.FieldDate.extend(SaleorderLineMixin, {
        _renderReadonly: function () {
           const value = field_utils.format.date(this.value, this.field, {})
           this.$el.text(value);
        },
        _getUpdateAllLinesAction: function () {
            return 'open_update_all_wizard';
        },
    });

    FieldsRegistry.add('subscription_date', ProductUpdateDateWidget);

    const ProductUpdatePricingWidget = FieldMany2One.extend(SaleorderLineMixin, {
        _getUpdateAllLinesAction: function () {
            return 'open_pricing_wizard';
        },
    });

    FieldsRegistry.add('subscription_pricing', ProductUpdatePricingWidget);

    return {ProductUpdateDateWidget: ProductUpdateDateWidget, ProductUpdatePricingWidget: ProductUpdatePricingWidget};

});
