/** @odoo-module **/

import { serializeDate } from "@web/core/l10n/dates";
import { getColorClass } from '@sale_subscription_dashboard/js/sale_subscription_dashboard_utils';
import { SaleSubscriptionDashboardBox } from './dashboard_box';
import { useEffect } from "@odoo/owl";

export class SaleSubscriptionDashboardStatBox extends SaleSubscriptionDashboardBox {
    setup() {
        super.setup();
        this.addedSymbol = this.state.stat_types[this.statType].add_symbol;
        this.tooltip = this.state.stat_types[this.statType].tooltip;
        this.isMonetary = this.addedSymbol === 'currency';
        this.boxType = 'stat';
        this.demoValues = {
            'mrr': 1000,
            'net_revenue': 55000,
            'nrr': 27000,
            'arpu': 20,
            'arr': 12000,
            'ltv': 120,
            'logo_churn': 7,
            'revenue_churn': 5,
            'nb_contracts': 50,
        };

        useEffect(() => {
            this.fetchChartValues().then(() => this.renderChart());
        }, () => [this.state.start_date, this.state.end_date, ...Object.values(this.state.filters)])
    }

    async fetchChartValues() {
        const data = await this.rpc(
            '/sale_subscription_dashboard/compute_graph_and_stats',
            {
                stat_type: this.statType,
                start_date: serializeDate(this.state.start_date),
                end_date: serializeDate(this.state.end_date),
                points_limit: 30,
                filters: this.state.filters,
                context: this.user.context,
            },
            {
                silent: true,
            }
        );
        this.chartState.value = data.stats.value_2;
        this.chartState.percentage = data.stats.perc;
        this.chartState.color = getColorClass(data.stats.perc, this.state.stat_types[this.statType].dir);
        this.chartState.chartValues = data.graph;
    }
};
