/** @odoo-module */

import { Component } from "@odoo/owl";

export class AccountReportDebugPopover extends Component {
    static template = "account_reports.AccountReportDebugPopover";
    static props = {
        close: Function,
        expressions_detail: Array,
        onClose: Function,
    };
}
