/** @odoo-module **/

import { registry } from '@web/core/registry';
import { localization } from "@web/core/l10n/localization";
import { serializeDate } from "@web/core/l10n/dates";
import { SaleSubscriptionDashboardAbstract } from '@sale_subscription_dashboard/components/dashboard_abstract';
import { formatNumber, getValue, formatValue, loadChart } from '@sale_subscription_dashboard/js/sale_subscription_dashboard_utils';
import { StatsHistory } from './stats_history';
import { StatsByPlan } from './stats_by_plan';
import { DetailedControlPanel } from './detailed_control_panel';
import { useMainDashboardData } from '@sale_subscription_dashboard/hooks/use_dashboard_data';
import { useEffect, useRef, useState } from "@odoo/owl";

const { DateTime } = luxon;

export class SaleSubscriptionDashboardDetailed extends SaleSubscriptionDashboardAbstract {
    setup() {
        super.setup();
        this.state = useMainDashboardData();
        this.detailedDashboardState = useState({
            value: 0,
            detailedChartData: [],
            growthData: false
        });
        this.selectedStat = this.props.selectedStat || 'mrr'; // TODO save selectedStat in local storage
        this.formatNumber = formatNumber;
        this.addedSymbol = this.state.stat_types[this.selectedStat].add_symbol;
        this.isMonetary = this.addedSymbol === 'currency';

        this.detailedChartRef = useRef('stat_chart_div');
        this.growthChartRef = useRef('mrr_growth_chart_div');

        useEffect(() => {
            this.fetchDetailedData();
        }, () => [this.state.start_date, this.state.end_date, ...Object.values(this.state.filters)])
    }

    fetchDetailedData() {
        return Promise.all([
            this.fetchStatValue(),
            this.fetchDetailedChartData(),
            this.fetchMRRGrowth()
        ]).then(() => this.renderCharts());
    }

    async fetchStatValue() {
        const data = await this.rpc(
            '/sale_subscription_dashboard/compute_stat',
            {
                stat_type: this.selectedStat,
                start_date: serializeDate(this.state.start_date),
                end_date: serializeDate(this.state.end_date),
                filters: this.state.filters,
                context: this.user.context,
            },
            {
                silent: true,
            }
        );
        this.detailedDashboardState.value = data[data.length-1][1];
    }

    async fetchDetailedChartData() {
        const data = await this.rpc(
            '/sale_subscription_dashboard/compute_graph',
            {
                stat_type: this.selectedStat,
                start_date: serializeDate(this.state.start_date),
                end_date: serializeDate(this.state.end_date),
                points_limit: 0,
                filters: this.state.filters,
                context: this.user.context,
            }
        );
        this.detailedDashboardState.detailedChartData = data;
    }

    async fetchMRRGrowth() {
        if (this.selectedStat !== 'mrr') {
            return;
        }
        const data = await this.rpc(
            '/sale_subscription_dashboard/compute_graph_mrr_growth',
            {
                start_date: serializeDate(this.state.start_date),
                end_date: serializeDate(this.state.end_date),
                points_limit: 0,
                filters: this.state.filters,
                context: this.user.context,
            }, {
                silent: true,
            }
        );
        this.detailedDashboardState.growthData = data;
    }

    renderCharts() {
        loadChart(this.detailedChartRef.el, this.state.stat_types[this.selectedStat].name, this.detailedDashboardState.detailedChartData, true);
        if (this.detailedDashboardState.growthData) {
            this.loadMRRGrowthStatChart(this.growthChartRef.el, this.detailedDashboardState.growthData);
        }
    }

    get displayStatsByPlan () {
        return !['nrr', 'arpu', 'logo_churn'].includes(this.selectedStat);
    }

    loadMRRGrowthStatChart(element, result) {
        if (!result.new_mrr) {
            return;  // no data, no graph, no crash
        }

        const labels = result.new_mrr.map(function (point) {
            return serializeDate(DateTime.fromISO(point[0]).setLocale('en'));
        });
        const datasets = [
            {
                label: this.env._t('New MRR'),
                data: result.new_mrr.map(getValue),
                borderColor: '#26b548',
                fill: false,
            },
            {
                label: this.env._t('Churned MRR'),
                data: result.churned_mrr.map(getValue),
                borderColor: '#df2e28',
                fill: false,
            },
            {
                label: this.env._t('Expansion MRR'),
                data: result.expansion_mrr.map(getValue),
                borderColor: '#fed049',
                fill: false,
            },
            {
                label: this.env._t('Down MRR'),
                data: result.down_mrr.map(getValue),
                borderColor: '#ffa500',
                fill: false,
            },
            {
                label: this.env._t('Net New MRR'),
                data: result.net_new_mrr.map(getValue),
                borderColor: '#2693d5',
                fill: false,
            }
        ];

        element.style.height = "20em";
        // clear children from element
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }

        const canvas = document.createElement('canvas');
        element.append(canvas);
        const ctx = canvas.getContext('2d');

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: datasets,
            },
            options: {
                layout: {
                    padding: {bottom: 30},
                },
                maintainAspectRatio: false,
                tooltips: {
                    mode: 'index',
                    intersect: false,
                },
                scales: {
                    yAxes: [{
                        scaleLabel: {
                            display: true,
                            labelString: 'MRR',
                        },
                        type: 'linear',
                        ticks: {
                            callback: formatValue,
                        },
                    }],
                    xAxes: [{
                        ticks: {
                            callback:  function (value) {
                                return DateTime.fromISO(value).setLocale('en').toFormat(localization.dateFormat || "dd/MM/yyyy")
                            }
                        },
                    }],
                },
            }
        });
    }
}

SaleSubscriptionDashboardDetailed.template = 'sale_subscription_dashboard.detailed_dashboard';
SaleSubscriptionDashboardDetailed.components = {
    DetailedControlPanel,
    StatsHistory,
    StatsByPlan
}

registry.category('actions').add('sale_subscription_dashboard_detailed', SaleSubscriptionDashboardDetailed);
