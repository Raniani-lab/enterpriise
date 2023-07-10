/** @odoo-module */

import { useService } from "@web/core/utils/hooks";

import { Component, useState } from "@odoo/owl";

export class AccountReportLineName extends Component {
    static template = "account_reports.AccountReportLineName";
    static props = {
        lineIndex: Number,
        line: Object,
    };

    setup() {
        this.action = useService("action");
        this.orm = useService("orm");
        this.controller = useState(this.env.controller);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Caret options
    //------------------------------------------------------------------------------------------------------------------
    get caretOptions() {
        return this.controller.caretOptions[this.props.line.caret_options];
    }

    get hasCaretOptions() {
        return this.caretOptions?.length > 0;
    }

    async caretAction(caretOption) {
        const res = await this.orm.call(
            "account.report",
            "dispatch_report_action",
            [
                this.controller.options.report_id,
                this.controller.options,
                caretOption.action,
                {
                    line_id: this.props.line.id,
                    action_param: caretOption.action_param,
                },
            ],
            {
                context: this.controller.context,
            }
        );

        return this.action.doAction(res);
    }

    // -----------------------------------------------------------------------------------------------------------------
    // Attributes
    // -----------------------------------------------------------------------------------------------------------------
    getClasses() {
        let classes = "acc_rep_name_ellipsis acc_rep_line acc_rep_line_indent";

        if (this.props.line.class) classes += ` ${this.props.line.class}`;
        if (this.props.line.unfoldable) classes += " js_account_report_foldable o_foldable_total";

        return classes;
    }

    getDomainClasses() {
        if (this.props.line.caret_options && this.props.line.level)
            return 'acc_rep_domain_line_' + this.props.line.level + ' acc_rep_line_name';

        return 'acc_rep_domain_line_2 acc_rep_line_name';
    }

    // -----------------------------------------------------------------------------------------------------------------
    // Action
    // -----------------------------------------------------------------------------------------------------------------
    async triggerAction() {
        const res = await this.orm.call(
            "account.report",
            "execute_action",
            [
                this.controller.options.report_id,
                this.controller.options,
                {
                    id: this.props.line.id,
                    actionId: this.props.line.action_id,
                },
            ],
            {
                context: this.controller.context,
            }
        );

        return this.action.doAction(res);
    }

    // -----------------------------------------------------------------------------------------------------------------
    // Load more
    // -----------------------------------------------------------------------------------------------------------------
    async loadMore() {
        const newLines = await this.orm.call(
            "account.report",
            "get_expanded_lines",
            [
                this.controller.options.report_id,
                this.controller.options,
                this.props.line.parent_id,
                this.props.line.groupby,
                this.props.line.expand_function,
                this.props.line.progress,
                this.props.line.offset,
            ],
        );

        this.controller.assignLinesVisibility(newLines)
        await this.controller.replaceLineWith(this.props.lineIndex, newLines);
    }

    // -----------------------------------------------------------------------------------------------------------------
    // Fold / Unfold
    // -----------------------------------------------------------------------------------------------------------------
    toggleFoldable() {
        if (this.props.line.unfoldable)
            if (this.props.line.unfolded)
                this.controller.foldLine(this.props.lineIndex);
            else
                this.controller.unfoldLine(this.props.lineIndex);
    }

    // -----------------------------------------------------------------------------------------------------------------
    // Footnote
    // -----------------------------------------------------------------------------------------------------------------
    get hasVisibleFootnote() {
        return this.props.line.visible_footnote;
    }
}
