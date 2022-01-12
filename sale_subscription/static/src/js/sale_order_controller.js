odoo.define('sale_subscription.SaleOrderFormController', function (require) {
    "use strict";

    const FormController = require('sale.SaleOrderFormController');
    const Dialog = require('web.Dialog');
    const core = require('web.core');
    const _t = core._t;
    const SaleOrderFormController = FormController.extend({
        custom_events: _.extend({}, FormController.prototype.custom_events, {
            open_pricing_wizard: '_onOpenPricingWizard',
        }),

        // -------------------------------------------------------------------------
        // Handlers
        // -------------------------------------------------------------------------

        /**
         * @private
         * @param {OdooEvent} ev
         */
        _onOpenPricingWizard(ev) {
            const orderLines = this._DialogReady(ev, 'one2many');
            const confirmCallback = () => {
                if (! ev.data.value) { // write false for all values
                    orderLines.slice(1).forEach((line) => {
                        this.trigger_up('field_changed', {
                            dataPointID: this.renderer.state.id,
                            changes: {order_line: {operation: "UPDATE", id: line.id, data: {[ev.data.fieldName]: ev.data.value}}},
                        });
                    });
                } else {
                    const linesData = orderLines.map(elem => ({id: elem.id, product_id: elem.data.product_id.data.id, }));
                    const pricelist_id = ev.target.recordData.pricelist_id && ev.target.recordData.pricelist_id.res_id;
                    this._rpc({
                        model: 'sale.order.line',
                        method: 'update_pricing_all_lines',
                        args: [ev.data.value,pricelist_id, linesData],
                    }).then(result => {
                        if (result.error) {
                            return false;
                        }
                        for (const [line_id, pricing_id] of Object.entries(result)) {
                            const line = orderLines.filter(line => line.id === line_id);
                            if (line) {
                                this.trigger_up('field_changed', {
                                    dataPointID: this.renderer.state.id,
                                    changes: {order_line: {operation: "UPDATE", id: line[0].id, data: {[ev.data.fieldName]: pricing_id}}},
                                    });
                            }
                        }
                    });
                }
            };
            if (orderLines && ev.target.recordData) {
                Dialog.confirm(this, _t("Do you want to apply this pricing to all order lines?"), {
                    buttons: [{
                                text: _t('YES'),
                                classes: 'btn-primary',
                                close: true,
                                click: () => confirmCallback(),
                            }, {
                                text: _t("NO"),
                                close: true,
                    }],
                });
            }
        },
    });


    return SaleOrderFormController;

});
