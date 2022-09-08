/** @odoo-module */

import { AccountReport } from "@account_reports/components/account_report/account_report";
import { AccountReportLine } from "@account_reports/components/account_report/line/line";

export class JournalReportLine extends AccountReportLine {
    static template = "account_reports.JournalReportLine";

    // -----------------------------------------------------------------------------------------------------------------
    // Classes
    // -----------------------------------------------------------------------------------------------------------------
    getJournalReportLineClasses() {
        let classes = "acc_rep_line acc_rep_line_indent";

        if (this.props.line.name_class) classes += ` ${this.props.line.name_class}`;
        if (this.props.line.unfoldable) classes += " js_account_report_foldable o_foldable_total";

        return classes;
    }

    // -----------------------------------------------------------------------------------------------------------------
    // Actions
    // -----------------------------------------------------------------------------------------------------------------
    async openTaxJournalItems(ev, name, taxType) {
        return this.controller.reportAction(ev, "journal_report_action_open_tax_journal_items", {
            name: name,
            tax_type: taxType,
            journal_id: this.props.line.journal_id,
            journal_type: this.props.line.journal_type,
            date_form: this.props.line.date_from,
            date_to: this.props.line.date_to,
        })
    }
}

AccountReport.registerCustomComponent(JournalReportLine);
