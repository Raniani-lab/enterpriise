/** @odoo-module **/

import { registry } from "@web/core/registry";

const { Component } = owl;

export class BankRecWidgetFormRecoModelsWidget extends Component {

    get record() {
        return this.env.model.root;
    }
    
    getRenderValues(){
        return this.record.data.reco_models_widget;
    }

    async selectRecoModel(reco_model_id, already_selected){
        if (already_selected) {
            this.record.update({ todo_command: `unselect_reconcile_model_button,${reco_model_id}`});
        } else {
            await this.record.update({ todo_command: `select_reconcile_model_button,${reco_model_id}`});
            const line_index = this.record.data.lines_widget.lines.slice(-1)[0].index.value;
            await this.record.update({todo_command: `mount_line_in_edit,${line_index}`})
        }
    }

}

BankRecWidgetFormRecoModelsWidget.template = "account_accountant.bank_rec_widget_form_reco_models_widget";

registry.category("fields").add("bank_rec_widget_form_reco_models_widget", BankRecWidgetFormRecoModelsWidget);
