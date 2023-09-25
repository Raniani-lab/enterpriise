/** @odoo-module */

import { AccountReport } from "@account_reports/components/account_report/account_report";
import { AccountReportLineCell } from "@account_reports/components/account_report/line_cell/line_cell";

import { useService } from "@web/core/utils/hooks";
import { markup, useState } from "@odoo/owl";

export class AgedPartnerBalanceLineCell extends AccountReportLineCell {
    static template = "account_reports.AgedPartnerBalanceLineCell";
    static components = {
        ...super.components,
    };

    setup() {
        this.action = useService("action");
        this.orm = useService("orm");
        this.controller = useState(this.env.controller);
    }

    // -----------------------------------------------------------------------------------------------------------------
    // Audit
    // -----------------------------------------------------------------------------------------------------------------
    async audit() {
        const options = { domain: "[('account_id.account_type', '=', 'liability_payable'), ('account_id.non_trade', '=', False)]", line_name: this.props.line.name, line: this.props.line};
        const period = this.retrieveColumnPeriod();
        if (period) {
            options['period'] = period;
        }

        const auditAction = await this.orm.call(
            "account.report",
            "action_open_payment_items_with_options",
            [
                this.controller.options.report_id,
                options,
            ],
            {
                context: this.controller.context,
            }
        );
        auditAction.help = markup(auditAction.help);
        return this.action.doAction(auditAction);
    }

    retrieveColumnPeriod() {
        return this.props.line.columns.find(({name,expression_label}) =>
            (name === this.props.cell.name && (expression_label.startsWith('period') || expression_label.startsWith('total')))
        ).expression_label
    }
}

AccountReport.registerCustomComponent(AgedPartnerBalanceLineCell);
