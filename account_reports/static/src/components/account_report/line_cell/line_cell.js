/** @odoo-module */

import { localization } from "@web/core/l10n/localization";
import { useService } from "@web/core/utils/hooks";

import { AccountReportCarryoverPopover } from "@account_reports/components/account_report/line_cell/popover/carryover_popover";
import { AccountReportEditPopover } from "@account_reports/components/account_report/line_cell/popover/edit_popover";

import { Component, useState } from "@odoo/owl";

export class AccountReportLineCell extends Component {
    static template = "account_reports.AccountReportLineCell";
    static props = {
        line: {
            type: Object,
            optional: true,
        },
        cell: Object,
    };

    setup() {
        this.action = useService("action");
        this.orm = useService("orm");
        this.popover = useService("popover");
        this.controller = useState(this.env.controller);
    }

    // -----------------------------------------------------------------------------------------------------------------
    // Attributes
    // -----------------------------------------------------------------------------------------------------------------
    get classes() {
        let classes = "acc_rep_line pt-0 pb-0 pe-0";

        if (this.props.line && this.props.line.class) classes += ` ${this.props.line.class}`;

        if (this.props.cell && typeof this.props.cell.no_format === 'number') classes += " number"

        if (this.props.cell && this.props.cell.no_format < 0) classes += " color-red"
        return classes;
    }

    // -----------------------------------------------------------------------------------------------------------------
    // Audit
    // -----------------------------------------------------------------------------------------------------------------
    async audit() {
        const auditAction = await this.orm.call(
            "account.report",
            "action_audit_cell",
            [
                this.controller.options.report_id,
                this.controller.options,
                {
                    report_line_id: this.props.cell.report_line_id,
                    expression_label: this.props.cell.expression_label,
                    calling_line_dict_id: this.props.line.id,
                    column_group_key: this.props.line.columns[0].column_group_key,
                },
            ],
            {
                context: this.controller.context,
            }
        );

        return this.action.doAction(auditAction);
    }

    // -----------------------------------------------------------------------------------------------------------------
    // Edit Popover
    // -----------------------------------------------------------------------------------------------------------------
    editPopover(ev) {
        const close = () => {
            this.popoverCloseFn();
            this.popoverCloseFn = null;
        }

        if (this.popoverCloseFn)
            close();

        this.popoverCloseFn = this.popover.add(
            ev.currentTarget,
            AccountReportEditPopover,
            {
                cell: this.props.cell,
                controller: this.controller,
                onClose: close,
            },
            {
                closeOnClickAway: true,
                position: localization.direction === "rtl" ? "bottom" : "left",
            },
        );
    }

    //------------------------------------------------------------------------------------------------------------------
    // Carryover popover
    //------------------------------------------------------------------------------------------------------------------
    showCarryoverPopover(ev) {
        const close = () => {
            this.popoverCloseFn();
            this.popoverCloseFn = null;
        }

        if (this.popoverCloseFn)
            close();

        this.popoverCloseFn = this.popover.add(
            ev.currentTarget,
            AccountReportCarryoverPopover,
            {
                carryoverData: JSON.parse(this.props.cell.info_popup_data),
                options: this.controller.options,
                context: this.controller.context,
                onClose: close,
            },
            {
                closeOnClickAway: true,
                position: localization.direction === "rtl" ? "bottom" : "left",
            },
        );
    }
}
