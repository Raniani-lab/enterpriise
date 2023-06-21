/** @odoo-module **/
import { useService } from "@web/core/utils/hooks";
import { Component, onWillStart, onWillUpdateProps, useState } from "@odoo/owl";

export class BankRecGlobalInfo extends Component {
    static template = "account_accountant.BankRecGlobalInfo";
    static props = {
        journalId: { type: Number },
    };

    setup() {
        this.values = null;
        this.orm = useService("orm");

        onWillStart(() => {
            this.fetchData(this.props.journalId);
        });
        onWillUpdateProps(nextProps => {
            this.fetchData(nextProps.journalId);
        });

        this.state = useState({});
    }

    /** Fetch the data to display. **/
    async fetchData(journalId) {
        this.values = await this.orm.call(
            "bank.rec.widget",
            "collect_global_info_data",
            [journalId],
        );
        Object.assign(this.state, {
            ...this.values,
            journalId: journalId,
        });
    }

    /** Open the bank reconciliation report. **/
    actionOpenBankGL() {
        this.env.methods.actionOpenBankGL(this.props.journalId);
    }

}
