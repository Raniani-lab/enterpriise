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
    // Line
    // -----------------------------------------------------------------------------------------------------------------
    get lineClasses() {
        let classes = ('level' in this.props.line) ? `line_level_${this.props.line.level}` : 'line_level_default';

        if (!this.props.line.visible || this.hiddenBySearchFilter())
            classes += " d-none";

        if (this.props.line.unfolded)
            classes += " unfolded";

        if (this.controller.isTotalLine(this.props.lineIndex))
            classes += " total";

        if (this.props.line.class)
            classes += ` ${this.props.line.class}`;

        return classes;
    }

    // -----------------------------------------------------------------------------------------------------------------
    // Growth comparison
    // -----------------------------------------------------------------------------------------------------------------
    get growthComparisonClasses() {
        let classes = "text-end";

        switch(this.props.line.growth_comparison_data.growth) {
            case 1:
                classes += " text-success";
                break;
            case 0:
                classes += " muted";
                break;
            case -1:
                classes += " text-danger";
                break;
        }

        return classes;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Search
    //------------------------------------------------------------------------------------------------------------------
    hiddenBySearchFilter() {
        if (!("lines_searched" in this.controller))
            return false;

        for (let searchLineId of this.controller.lines_searched)
            if (this.controller.isLineRelatedTo(searchLineId, this.props.line.id) || this.props.line.id === searchLineId)
                return false;

        return true;
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
                expressionsDetail: JSON.parse(this.props.line.debug_popup_data).expressions_detail,
                onClose: close,
            },
            {
                closeOnClickAway: true,
                position: localization.direction === "rtl" ? "left" : "right",
            },
        );
    }
}
