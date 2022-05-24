/** @odoo-module */

import viewRegistry from "web.view_registry";

import {BankRecWidgetFormInnerTabList, BankRecWidgetFormInnerTabListRenderer} from "@account_accountant/js/bank_rec_widget_form_inner_tab";


export const BankRecWidgetFormInnerTabBatchPaymentsRenderer = BankRecWidgetFormInnerTabListRenderer.extend({

    // @override
    _renderRow(record){
        let $tr = this._super(...arguments);

        $tr.addClass("o_bank_rec_widget_batch_payment");
        if(record.data.batch_type === "outbound"){
            $tr.find("td.o_list_number[name='amount']").addClass("text-danger");
        }else{
            $tr.find("td.o_list_number[name='amount']").addClass("text-info");
        }

        return $tr;
    },

    // @override
    _onNotebookTabRowClicked(recordId){
        this.trigger_up("batch-payments-view-line-clicked", {recordId: recordId});
    },

});


export const BankRecWidgetFormInnerTabBatchPayments = BankRecWidgetFormInnerTabList.extend({
    config: {
        ...BankRecWidgetFormInnerTabList.prototype.config,
        Renderer: BankRecWidgetFormInnerTabBatchPaymentsRenderer,
    },
});


viewRegistry.add("bank_rec_widget_form_batch_payments_list", BankRecWidgetFormInnerTabBatchPayments);
