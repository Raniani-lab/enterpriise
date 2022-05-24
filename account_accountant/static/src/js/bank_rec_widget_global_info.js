/** @odoo-module **/
"use strict";

const { onWillStart } = owl;

import field_registry from 'web.field_registry_owl';
import { LegacyComponent } from "@web/legacy/legacy_component";


export class BankRecWidgetGlobalInfo extends LegacyComponent{

    // @override
    setup() {
        onWillStart(() => this._fetchData(this.props));
    }

    async _fetchData(props){
        this.data = await this.rpc({
            model: "bank.rec.widget",
            method: "collect_global_info_data",
            args: [[], props.journal_id],
        });
    }

    async _onClickBalance(ev){
        ev.stopPropagation();

        const actionData = await this.rpc({
            model: "bank.rec.widget",
            method: "action_open_bank_reconciliation_report",
            args: [[], this.props.journal_id],
        });
        await this.trigger("perform-do-action", {actionData: actionData});
    }

}
BankRecWidgetGlobalInfo.template = "account_accountant.bank_rec_widget_global_info";

field_registry.add("bank_rec_widget_global_info", BankRecWidgetGlobalInfo);
