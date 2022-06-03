/** @odoo-module **/

import { ControlPanel } from "@web/search/control_panel/control_panel";
import { useSalespeopleDashboardData } from "@sale_subscription_dashboard/hooks/use_dashboard_data";
import { SaleSubscriptionDashboardDateFilter } from "@sale_subscription_dashboard/components/main_control_panel/date_filter";
import { SalespeopleSelector } from "@sale_subscription_dashboard/components/dashboard_salesperson/salespeople_selector";

export class SalespeopleDateFilter extends SaleSubscriptionDashboardDateFilter {
    getState() {
        return useSalespeopleDashboardData();
    }
}

export class SalespeopleControlPanel extends ControlPanel {
    setup() {
        this.controlPanelDisplay = {
            "bottom-right": false,
        }
    }
}

SalespeopleControlPanel.components = {
    ControlPanel,
    SalespeopleDateFilter,
    SalespeopleSelector
}

SalespeopleControlPanel.props = {
    onPrintPreview: {type: Function}
}

SalespeopleControlPanel.template = 'sale_subscription_dashboard.salespeople_control_panel';
