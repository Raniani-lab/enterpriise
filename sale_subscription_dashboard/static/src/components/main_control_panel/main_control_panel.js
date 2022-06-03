/** @odoo-module **/

import { ControlPanel } from "@web/search/control_panel/control_panel";
import { Component } from "@odoo/owl";
import { useMainDashboardData } from "@sale_subscription_dashboard/hooks/use_dashboard_data";
import { SaleSubscriptionDashboardDateFilter } from "./date_filter";
import { SaleSubscriptionDashboardOptionsFilter } from "./option_filters";

export class SaleSubscriptionDashboardMainControlPanel extends Component {
    setup() {
        this.controlPanelDisplay = {
            "bottom-right": false,
        }
        this.state = useMainDashboardData();
    }
}

SaleSubscriptionDashboardMainControlPanel.components = {
    ControlPanel,
    SaleSubscriptionDashboardDateFilter,
    SaleSubscriptionDashboardOptionsFilter
}

SaleSubscriptionDashboardMainControlPanel.template = 'sale_subscription_dashboard.main_control_panel';
