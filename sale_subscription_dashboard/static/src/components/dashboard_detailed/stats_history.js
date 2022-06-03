/** @odoo-module **/

import { useService } from "@web/core/utils/hooks";
import { serializeDate } from "@web/core/l10n/dates";
import { formatNumber, getColorClass } from '@sale_subscription_dashboard/js/sale_subscription_dashboard_utils';
import { useMainDashboardData } from '@sale_subscription_dashboard/hooks/use_dashboard_data';
import { Component, useEffect, useState } from "@odoo/owl";

export class StatsHistory extends Component {
    setup() {
        this.rpc = useService("rpc");
        this.user = useService("user");
        this.state = useMainDashboardData()
        this.historyState = useState({
            statsHistory: []
        })
        this.selectedStat = this.props.selectedStat;
        this.formatNumber = formatNumber;
        this.getColorClass = getColorClass;
        this.addedSymbol = this.state.stat_types[this.selectedStat].add_symbol;
        this.isMonetary = this.addedSymbol === 'currency';

        useEffect(() => {
            this.fetchStatsHistory();
        }, () => [this.state.start_date, this.state.end_date, ...Object.values(this.state.filters)]);

    }

    async fetchStatsHistory() {
        const result = await this.rpc(
            '/sale_subscription_dashboard/get_stats_history',
            {
                stat_type: this.selectedStat,
                start_date: serializeDate(this.state.start_date),
                end_date: serializeDate(this.state.end_date),
                filters: this.state.filters,
                context: this.user.context,
            }, {
                silent: true,
            }
        );
        this.historyState.statsHistory = Object.keys(result).reduce((acc, key) => {
            acc[key] = Math.round(result[key] * 100) / 100
            return acc;
        }, {});
    }

    rate(oldValue, newValue) {
        return oldValue === 0 ? 0 : parseInt(100.0 * (newValue - oldValue) / oldValue);
    }
}

StatsHistory.template = 'sale_subscription_dashboard.stats_history';
