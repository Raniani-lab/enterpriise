/** @odoo-module **/

import { ContractModifications } from './contract_modifications';
import { NRRInvoices } from './nrr_invoices';
import { SalespersonSummary } from './salesperson_summary';
import { useSalespeopleDashboardData } from '@sale_subscription_dashboard/hooks/use_dashboard_data';
import { formatMonetaryNumber } from '@sale_subscription_dashboard/js/sale_subscription_dashboard_utils';
import { Component, useEffect, useRef } from "@odoo/owl";

export class SaleSubscriptionDashboardSalesperson extends Component {
    setup() {
        this.state = useSalespeopleDashboardData();
        this.salesperson = this.props.salesperson;
        this.currentCompany = this.props.currentCompany;
        this.growthSalespersonChartRef = useRef('mrr_growth_salesperson');
        this.nCompanies = this.countCompanies();

        useEffect(() => {
            this.renderChart();
        });
    }

    get salesPeopleStatistics() {
        return this.state.salespeople_statistics[this.salesperson.id]
    }

    countCompanies() {
        const getCompanyIds = (array) => array.map(val => val.company_id);

        const contractModificationsCompanyCount = getCompanyIds(this.salesPeopleStatistics.contract_modifications);
        const NRRInvoicesCompanyCount = getCompanyIds(this.salesPeopleStatistics.nrr_invoices);

        return new Set([this.currentCompany, ...contractModificationsCompanyCount, ...NRRInvoicesCompanyCount]).size;
    }

    renderChart() {
        const chart = this.loadMRRSalespersonChart(this.growthSalespersonChartRef.el, this.salesPeopleStatistics, this.state.currency_id);
        this.props.setBarGraph(this.salesperson.id, chart);
    }

    loadMRRSalespersonChart(element, result, currencyId) {
        const labels = [
            this.env._t("New MRR"),
            this.env._t("Churned MRR"),
            this.env._t("Expansion MRR"),
            this.env._t("Down MRR"),
            this.env._t("Net New MRR"),
            this.env._t("NRR")
        ];

        const datasets = [{
            label: this.env._t("MRR Growth"),
            data: [result.new, result.churn, result.up, result.down, result.net_new, result.nrr],
            backgroundColor: ["#1f77b4","#ff7f0e","#aec7e8","#ffbb78","#2ca02c","#98df8a"],
        }];

        element.style.height = "16em";
        // clear children from element
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }
        const canvas = document.createElement('canvas');
        element.append(canvas);
    
        const ctx = canvas.getContext('2d');
        const ChartValuePlugin = {
            updated: false,
            afterDraw:(chart) => {
                ctx.font = chart.config.options.defaultFontFamily;
                ctx.fillStyle = chart.config.options.defaultFontColor;
                const chartdatasets = chart.data.datasets;
                // Clear the area where values are drawn to avoid rendering multiple times and glitches
                ctx.clearRect(50, -5, 2000, 20);
                Chart.helpers.each(chartdatasets.forEach((dataset, i) => {
                    const meta = chart.controller.getDatasetMeta(i);
                    Chart.helpers.each(meta.data.forEach((bar, index) => {
                        ctx.textAlign = "center";
                        ctx.fillText(formatMonetaryNumber(dataset.data[index], currencyId), bar._model.x, 15);
                    }), this);
                }), this);
            },
        };
        const barGraph = new Chart(ctx, {
            type: 'bar',
            plugins : [ChartValuePlugin],
            data: {
                labels: labels,
                datasets: datasets,
            },
            options: {
                layout: {
                    padding: {bottom: 15, top: 17},
                },
                legend: {
                    display: false,
                },
                maintainAspectRatio: false,
                tooltips: {
                    enabled: false,
                },
            },
        });
        return barGraph;
    }
}

SaleSubscriptionDashboardSalesperson.template = 'sale_subscription_dashboard.salesperson';
SaleSubscriptionDashboardSalesperson.components = {
    ContractModifications,
    NRRInvoices,
    SalespersonSummary
}
