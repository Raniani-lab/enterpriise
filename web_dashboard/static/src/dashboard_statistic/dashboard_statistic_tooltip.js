/* @odoo-module */
import { registry } from "@web/core/registry";

class DashboardStatisticTooltip extends owl.Component {}
DashboardStatisticTooltip.template = "web_dashboard.DashboardStatisticTooltip";

registry.category("tooltips").add("dashboard_statistic_tooltip", DashboardStatisticTooltip);
