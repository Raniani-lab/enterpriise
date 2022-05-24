/** @odoo-module */

import { ComponentWrapper } from "web.OwlCompatibility";
import { View } from "@account_accountant/js/legacy_view_adapter";

import { BankRecWidgetFormController } from "@account_accountant/js/bank_rec_widget_form";


BankRecWidgetFormController.include({
    events: {
        ...BankRecWidgetFormController.prototype.events,

        // Owl events.
        "batch-payments-view-line-clicked": "_onBatchPaymentsViewMountLine",
    },

    // @override
    _initLazyNotebookTabs(){
        let self = this;
        let res = this._super(...arguments);
        res.push({
            tabName: "batch_payments_tab",
            anchorName: "bank_rec_widget_form_batch_payments_list_anchor",
            listOptions: {
                selectedIdsFieldName: "selected_batch_payment_ids",
                trClass: "o_bank_rec_widget_batch_payment",
            },
            initMethod: function(){
                let data = self.model.get(self.handle).data;
                let batchPaymentsWidgetData = JSON.parse(data.batch_payments_widget);

                return new ComponentWrapper(self, View, {
                    resModel: "account.batch.payment",
                    type: "list",
                    views: [[false, "search"]],
                    load_filters: true,
                    domain: batchPaymentsWidgetData.domain,
                    context: Object.assign({dynamicFilters: batchPaymentsWidgetData.dynamic_filters}, batchPaymentsWidgetData.context),
                });
            },
        });
        return res;
    },

    // -------------------------------------------------------------------------
    // HANDLERS
    // -------------------------------------------------------------------------

    _onBatchPaymentsViewMountLine(ev){
        ev.stopPropagation();
        let recordId = ev.detail.recordId;
        let data = this.model.get(this.handle).data;

        if(data.selected_batch_payment_ids.data.some(x => x.data.id === recordId)){
            return;
        }

        // Trigger the onchange.
        this.trigger_up("field_changed", {
            dataPointID: this.handle,
            changes: {todo_command: `add_new_batch_payment,${recordId}`},
        });
    },

});
