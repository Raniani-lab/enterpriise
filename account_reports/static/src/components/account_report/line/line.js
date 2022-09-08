/** @odoo-module */

import { localization } from "@web/core/l10n/localization";

import { useService } from "@web/core/utils/hooks";
import { Component, useState } from "@odoo/owl";

import { AccountReportDebugPopover } from "@account_reports/components/account_report/line/popover/debug_popover";

export class AccountReportLine extends Component {
    static template = "account_reports.AccountReportLine";
    static props = {
        lineIndex: Number,
        line: Object,
    };

    setup() {
        this.popover = useService("popover");
        this.controller = useState(this.env.controller);
    }

    // -----------------------------------------------------------------------------------------------------------------
    // Classes
    // -----------------------------------------------------------------------------------------------------------------
    get lineClasses() {
        let classes;

        if (!this.props.line.caret_options && 'level' in this.props.line)
            classes = `acc_rep_searchable acc_rep_level${this.props.line.level}`;
        else
            classes = "acc_rep_default_style";

        if (this.props.line.class)
            classes += ` ${this.props.line.class}`;

        if (this.props.line.unfolded)
            classes += " acc_rep_parent_unfolded";

        if (!this.props.line.visible)
            classes += " d-none";

        // Search
        if ("lines_searched" in this.controller) {
            const oldestAncestorID = this.props.line.id.split('|')[0];

            if (
                !this.controller.lines_searched.lines.has(this.props.line.id) &&
                (
                    !(oldestAncestorID in this.controller.lines_searched.ancestors) ||
                    (
                        oldestAncestorID in this.controller.lines_searched.ancestors &&
                        this.controller.lines_searched.ancestors[oldestAncestorID] === this.props.line.level
                    )
                )
            ) {
                classes += " d-none";
            }
        }

        return classes;
    }

    get comparisonClasses() {
        let classes = "acc_rep_column_value text-nowrap";

        if (this.props.line.growth_comparison_data.class)
            classes += ` ${this.props.line.growth_comparison_data.class}`;

        return classes;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Debug popover
    //------------------------------------------------------------------------------------------------------------------
    showDebugPopover(ev) {
        const close = () => {
            this.popoverCloseFn();
            this.popoverCloseFn = null;
        }

        if (this.popoverCloseFn)
            close();

        this.popoverCloseFn = this.popover.add(
            ev.currentTarget,
            AccountReportDebugPopover,
            {
                expressions_detail: JSON.parse(this.props.line.debug_popup_data).expressions_detail,
                onClose: close,
            },
            {
                closeOnClickAway: true,
                position: localization.direction === "rtl" ? "bottom" : "left",
            },
        );
    }
}
