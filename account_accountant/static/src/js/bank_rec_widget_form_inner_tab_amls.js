/** @odoo-module **/

import viewRegistry from "web.view_registry";

import {BankRecWidgetFormInnerTabList, BankRecWidgetFormInnerTabListRenderer} from "./bank_rec_widget_form_inner_tab";


export const BankRecWidgetFormInnerTabAmlsRenderer = BankRecWidgetFormInnerTabListRenderer.extend({

    // @override
    _renderRow(record){
        let $tr = this._super(...arguments);

        $tr.addClass("o_bank_rec_widget_aml");

        if(record.data.amount_residual_currency < 0.0){
            $tr.find("td.o_list_number[name='amount_residual_currency']").addClass("text-danger");
            $tr.find("td.o_list_number[name='amount_residual']").addClass("text-danger");
        }

        return $tr;
    },

    // @override
    _onNotebookTabRowClicked(recordId){
        this.trigger_up("amls-view-line-clicked", {recordId: recordId});
    },

});


export const BankRecWidgetFormInnerTabAmls = BankRecWidgetFormInnerTabList.extend({
    config: {
        ...BankRecWidgetFormInnerTabList.prototype.config,
        Renderer: BankRecWidgetFormInnerTabAmlsRenderer,
    },
});


viewRegistry.add("bank_rec_widget_form_amls_list", BankRecWidgetFormInnerTabAmls);
