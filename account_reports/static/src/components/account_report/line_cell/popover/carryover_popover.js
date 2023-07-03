/** @odoo-module */

import { useService } from "@web/core/utils/hooks";
import { Component } from "@odoo/owl";

export class AccountReportCarryoverPopover extends Component {
    static template = "account_reports.AccountReportCarryoverPopover";
    static props = {
        close: Function,
        carryoverData: Object,
        options: Object,
        context: Object,
    };

    setup() {
        this.actionService = useService("action");
        this.orm = useService("orm");
    }

    //------------------------------------------------------------------------------------------------------------------
    //
    //------------------------------------------------------------------------------------------------------------------
    async viewCarryoverLinesAction(expressionId) {
        const viewCarryoverLinesAction = await this.orm.call(
            "account.report.expression",
            "action_view_carryover_lines",
            [
                expressionId,
                this.props.options,
            ],
            {
                context: this.props.context,
            }
        );

        return this.actionService.doAction(viewCarryoverLinesAction);
    }
}
