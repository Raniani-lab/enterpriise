/** @odoo-module */

import { AccountReport } from "@account_reports/components/account_report/account_report";
import { AccountReportLine } from "@account_reports/components/account_report/line/line";

export class ConsolidationReportLine extends AccountReportLine {
    static template = "account_consolidation.ConsolidationReportLine";

    //------------------------------------------------------------------------------------------------------------------
    // Attributes
    //------------------------------------------------------------------------------------------------------------------
    getLineDataCellClasses(cellIndex) {
        const hierarchyEnable = this.controller.options.column_headers.length > 1;

        let classes = "acc_rep_line";

        if (this.props.line.columns[cellIndex].class)
            classes += ` ${ this.props.line.columns[cellIndex].class }`;
        else if (this.controller.options.column_headers[0][cellIndex].class)
            classes += ` ${ this.controller.options.column_headers[0][cellIndex].class }`;

        if (this.props.line.unfoldable)
            classes += " o_foldable_total";

        if (!hierarchyEnable)
            classes += " acc_rep_line_indent";

        return classes;
    }

    getLineDataCellStyles(cellIndex) {
        if (this.props.line.style)
            return this.props.line.style

        if (this.controller.options.column_headers[0][cellIndex].style)
            return this.controller.options.column_headers[0][cellIndex].style

        return "";
    }
}

AccountReport.registerCustomComponent(ConsolidationReportLine);
