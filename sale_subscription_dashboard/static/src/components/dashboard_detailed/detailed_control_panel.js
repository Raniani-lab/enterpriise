/** @odoo-module **/

import { useService } from "@web/core/utils/hooks";
import { ControlPanel } from "@web/search/control_panel/control_panel";
import { SaleSubscriptionDashboardDateFilter } from "@sale_subscription_dashboard/components/main_control_panel/date_filter";
import { SaleSubscriptionDashboardMainControlPanel } from "@sale_subscription_dashboard/components/main_control_panel/main_control_panel"
import { SaleSubscriptionDashboardOptionsFilter } from "@sale_subscription_dashboard/components/main_control_panel/option_filters";

export class DetailedControlPanel extends SaleSubscriptionDashboardMainControlPanel {
    setup() {
        super.setup();
        this.actionService = useService("action")
        this.selectedStat = this.props.selectedStat;
        this.isDetailedButtonVisible = ['mrr', 'nrr', 'net_revenue'].includes(this.selectedStat);
    }

    onDetailedAnalysisClick() {
        let additionalContext = {};
        let viewXMLId = "account.action_account_invoice_report_all";
        if (this.selectedStat === 'mrr') {
            additionalContext = {
                'search_default_subscription_end_date': this.state.end_date.toISODate(),
                'search_default_subscription_start_date': this.state.start_date.toISODate(),
                // TODO: add contract_ids as another filter
            };
            viewXMLId = "sale_subscription_dashboard.action_move_line_entries_report";
        }

        this.actionService.doAction(viewXMLId, { additionalContext });
    }
}

DetailedControlPanel.components = {
    ControlPanel,
    SaleSubscriptionDashboardDateFilter,
    SaleSubscriptionDashboardOptionsFilter
}

DetailedControlPanel.template = 'sale_subscription_dashboard.detailed_control_panel';
