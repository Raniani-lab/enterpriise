/** @odoo-module **/

import { SaleSubscriptionDashboardBox } from './dashboard_box';
import { serializeDate } from "@web/core/l10n/dates";
import { computeForecastValues } from '@sale_subscription_dashboard/js/sale_subscription_dashboard_utils';
import { useEffect } from "@odoo/owl";

export class SaleSubscriptionDashboardForecastBox extends SaleSubscriptionDashboardBox {
    setup() {
        super.setup();
        this.boxType = 'forecast';
        this.addedSymbol = this.state.forecast_stat_types[this.statType].add_symbol;
        this.tooltip = this.state.forecast_stat_types[this.statType].tooltip;
        this.isMonetary = this.addedSymbol === 'currency';
        this.isForecast = true;
        this.demoValues = {
            'mrr_forecast': 12000,
            'contracts_forecast': 240,
        };

        useEffect(() => {
            this.fetchChartValues().then(() => this.renderChart());
        }, () => [this.state.end_date, ...Object.values(this.state.filters)])
    }

    async fetchChartValues() {
        const data = await this.rpc(
            '/sale_subscription_dashboard/get_default_values_forecast',
            {
                forecast_type: this.statType,
                end_date: serializeDate(this.state.end_date),
                filters: this.state.filters,
                context: this.user.context,
            },
            {
                silent: true,
            }
        );
        this.chartState.chartValues = computeForecastValues(
            data.starting_value,
            data.projection_time,
            'linear',
            data.churn,
            data.linear_growth,
            0
        );
        this.chartState.value = this.chartState.chartValues[this.chartState.chartValues.length - 1][1];
    }
};
