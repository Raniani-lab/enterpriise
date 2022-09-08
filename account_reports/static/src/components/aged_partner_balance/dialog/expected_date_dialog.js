/** @odoo-module */

import { DateTimeInput } from '@web/core/datetime/datetime_input';
import { Dialog } from "@web/core/dialog/dialog";

import { Component } from "@odoo/owl";

export class ExpectedDateDialog extends Component {
    static template = "account_reports.ExpectedDateDialog";
    static components = {
        DateTimeInput,
        Dialog,
    };

    _save() {
        this.props.save(this.date);
        this.props.close();
    }

    _cancel() {
        this.props.close();
    }

    onDateTimeChanged(date) {
        this.date = date;
    }
}
