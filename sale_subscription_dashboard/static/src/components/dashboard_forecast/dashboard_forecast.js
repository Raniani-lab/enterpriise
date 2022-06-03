/** @odoo-module **/

import { registry } from '@web/core/registry';
import { ControlPanel } from "@web/search/control_panel/control_panel";
import { useMainDashboardData } from '@sale_subscription_dashboard/hooks/use_dashboard_data';
import { DashboardForecastChart } from './forecast_chart';
import { Component } from "@odoo/owl";

export class DashboardForecast extends Component {
    setup() {
        this.state = useMainDashboardData();
        this.controlPanelDisplay = {
            "top-right": false,
            "bottom-left": false,
            "bottom-right": false,
        };
    }
}

DashboardForecast.template = "sale_subscription_dashboard.forecast"
DashboardForecast.components = {
    DashboardForecastChart,
    ControlPanel
}

registry.category('actions').add('sale_subscription_dashboard_forecast', DashboardForecast);
