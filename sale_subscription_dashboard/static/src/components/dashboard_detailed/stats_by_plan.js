/** @odoo-module **/

import { useService } from "@web/core/utils/hooks";
import { serializeDate } from "@web/core/l10n/dates";
import { formatNumber } from '@sale_subscription_dashboard/js/sale_subscription_dashboard_utils';
import { useMainDashboardData } from '@sale_subscription_dashboard/hooks/use_dashboard_data';
import { Component, useEffect, useState } from "@odoo/owl";

export class StatsByPlan extends Component {
    setup() {
        this.rpc = useService("rpc");
        this.user = useService("user");
        this.formatNumber = formatNumber;
        this.value = this.props.value;
        this.selectedStat = this.props.selectedStat;
        this.state = useMainDashboardData();
        this.statsByPlanState = useState({
            statsByPlanData: []
        })

        this.addedSymbol = this.state.stat_types[this.selectedStat].add_symbol;
        this.isMonetary = this.addedSymbol === 'currency';

        useEffect(() => {
            this.fetchStatsByPlan();
        }, () => [this.state.start_date, this.state.end_date, ...Object.values(this.state.filters)])
    }

    async fetchStatsByPlan() {
        this.statsByPlanState.statsByPlanData = await this.rpc(
            '/sale_subscription_dashboard/get_stats_by_plan',
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
    }
}

StatsByPlan.template = 'sale_subscription_dashboard.stats_by_plan';
