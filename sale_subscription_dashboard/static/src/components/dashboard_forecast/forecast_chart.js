/** @odoo-module **/

import { session } from "@web/session";
import { localization } from "@web/core/l10n/localization";
import { serializeDate } from "@web/core/l10n/dates";
import { getValue, formatValue, formatMonetaryNumber, computeForecastValues } from '@sale_subscription_dashboard/js/sale_subscription_dashboard_utils';
import { SaleSubscriptionDashboardAbstract } from "@sale_subscription_dashboard/components/dashboard_abstract";
import { useMainDashboardData } from '@sale_subscription_dashboard/hooks/use_dashboard_data';
import { useState, useEffect, useRef } from "@odoo/owl";

export class DashboardForecastChart extends SaleSubscriptionDashboardAbstract {
    setup() {
        super.setup();
        this.state = useMainDashboardData();
        this.forecastType = this.props.forecastType;
        this.formatMonetaryNumber = formatMonetaryNumber;

        this.inputs = {
            starting_value: {
                label: this.forecastType === 'mrr' ? this.currencySymbol : this.env._t('Subcriptions'),
                name: this.forecastType === 'mrr'? this.env._t('Starting MRR') : this.env._t('Starting Subscriptions')
            },
            growth: {
                label: {
                    linear_growth: this.forecastType === 'mrr' ? this.currencySymbol : this.env._t('Subscriptions'),
                    expon_growth: '%',
                },
                name: this.env._t('Revenue Growth'),
                growthTypeInput: true
            },
            churn: {
                label: '%',
                name: this.forecastType === 'mrr'? this.env._t('Revenue Churn') : this.env._t('Subscriptions Churn')
            },
            projection_time: {
                label: this.env._t('Months'),
                name: this.env._t('Projection Time')
            }
        };

        this.chartRef = useRef('forecast-chart-ref');
        this.chartState = useState({
            chartData: {
                growth_type: 'linear',
            },
            computedValue: 0
        });

        useEffect(() => {
            this.reloadChart();
        }, () => [...Object.values(this.chartState.chartData)]);
    }

    async fetchData() {
        await super.fetchData();
        await this.fetchDefaultValuesForecast(this.forecastType);
    }

    async fetchDefaultValuesForecast(forecast_type) {
        const data = await this.rpc(
            '/sale_subscription_dashboard/get_default_values_forecast',
            {
                end_date: serializeDate(this.state.end_date),
                forecast_type: forecast_type,
                filters: this.state.filters,
                context: this.user.context,
            },
            {
                silent: true,
            }
        );
        this.chartState.chartData = {
            ...this.chartState.chartData,
            ...data
        }
    }

    reloadChart() {
        const computed_values = computeForecastValues(
            this.chartState.chartData.starting_value,
            this.chartState.chartData.projection_time,
            this.chartState.chartData.growth_type,
            this.chartState.chartData.churn,
            this.chartState.chartData.linear_growth,
            this.chartState.chartData.expon_growth
        );
        this.loadChartForecast(this.chartRef.el, computed_values);
        this.chartState.computedValue = parseInt(computed_values[computed_values.length - 1][1]);
    }

    onForecastInput(ev, dataType) {
        this.chartState.chartData[dataType] = Number(ev.target.value);
    }

    get currencySymbol() {
        return session.currencies[this.state.currency_id] &&
            session.currencies[this.state.currency_id].symbol || '';
    }

    loadChartForecast(element, values) {
        const labels = [];
        const data = [];

        for (const point of values) {
            labels.push(point[0]);
            data.push(getValue(point));
        }

        const datasets = [{
            data,
            backgroundColor: 'rgba(38,147,213,0.2)',
            borderColor: 'rgba(38,147,213,0.2)',
            borderWidth: 3,
            pointBorderWidth: 1,
            cubicInterpolationMode: 'monotone',
            fill: 'origin',
        }];

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
                legend: {
                    display: false,
                },
                maintainAspectRatio: false,
                tooltips: {
                    mode: 'index',
                    intersect: false,
                },
                scales: {
                    yAxes: [{
                        type: 'linear',
                        ticks: {
                            callback: formatValue,
                        },
                    }],
                    xAxes: [{
                        ticks: {
                            callback:  function (value) {
                                return value.setLocale('en').toFormat(localization.dateFormat || "dd/MM/yyyy")
                            }
                        },
                    }],
                },
            }
        });
    }
}

DashboardForecastChart.template = 'sale_subscription_dashboard.forecast_chart'
