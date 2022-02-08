/** @odoo-module **/

import { loadAssets } from '@web/core/assets';

const { Component } = owl;
const { useRef, useState } = owl.hooks;

export class PayrollDashboardStats extends Component {

    // Lifecycle

    /**
     * @override
     */
    setup() {
        this.canvasRef = useRef('canvas');
        this.state = useState(this._defaultState());
    }

    /**
     * @override
     */
    async willStart() {
        await loadAssets({
            jsLibs: ["/web/static/lib/Chart/Chart.js"],
        });
    }

    /**
     * @override
     */
    willUnmount() {
        if (this.chart) {
            this.chart.destroy();
        }
    }

    /**
     * @override
     */
    mounted() {
        this._renderChart();
    }

    /**
     * @override
     */
    patched() {
        this._renderChart();
    }

    // Public

    /**
     * @override
     */
    formatHelp() {
        return JSON.stringify({
            help: this.data.help,
        })
    }

    /**
     * @override
     */
    toggle() {
        this.state.monthly = !this.state.monthly;
    }

    /**
     * @returns {object} The complete data provided as props
     */
    get data() {
        return this.props.data;
    }

    /**
     * @returns {object} The graph type provided as props
     */
    get type() {
        return this.props.data.type;
    }

    /**
     * @returns {object} The current chart data to be used depending on the state
     */
    get graphData() {
        return this.props.data.data[this.state.monthly ? 'monthly': 'yearly'];
    }

    /**
     * @return {object} Complete data provided as props
     */
    get actionData() {
        return this.props.data.actions;
    }

    // Private

    /**
     * Executes the action given.
     *
     * @param {object} action
     */
    _doAction(action) {
        this.trigger('do-action', {
            action: action,
        });
    }

    /**
     * Creates and binds the chart on `canvasRef`.
     *
     * @private
     */
    _renderChart() {
        if (this.chart) {
            this.chart.destroy();
        }
        const ctx = this.canvasRef.el.getContext('2d');
        this.chart = new Chart(ctx, this._getChartConfig());
    }

    /**
     * @private
     * @returns {object} The default state for our component
     */
    _defaultState() {
        return {
            monthly: true,
        }
    }

    /**
     * @private
     * @returns {object} Chart config for the current data
     */
    _getChartConfig() {
        if (this.data.type === 'line') {
            return this._getLineChartConfig();
        } else if (this.data.type === 'bar') {
            return this._getBarChartConfig();
        } else if (this.data.type === 'stacked_bar') {
            return this._getStackedBarChartConfig();
        }
        return {};
    }

    /**
     * @private
     * @returns {object} Chart config of type 'line'
     */
    _getLineChartConfig() {
        const data = this.graphData
        const labels = data.map(function (pt) {
            return pt.x;
        });
        const borderColor = this.data.is_sample ? '#dddddd' : '#875a7b';
        const backgroundColor = this.data.is_sample ? '#ebebeb' : '#dcd0d9';
        return {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    fill: 'start',
                    label: this.data.label,
                    backgroundColor: backgroundColor,
                    borderColor: borderColor,
                    borderWidth: 2,
                }],
            },
            options: {
                legend: {display: false},
                scales: {
                    yAxes: [
                        {
                            display: false,
                            ticks: {
                                beginAtZero: true,
                            },
                        }
                    ],
                    xAxes: [{display: false}],
                },
                maintainAspectRatio: false,
                elements: {
                    line: {
                        tension: 0.000001,
                    },
                },
                tooltips: {
                    intersect: false,
                    position: 'nearest',
                    caretSize: 0,
                },
            },
        };
    }

    /**
     * @private
     * @returns {object} Chart config of type 'bar'
     */
    _getBarChartConfig() {
        const self = this;
        const data = [];
        const labels = [];
        const backgroundColors = [];

        this.graphData.forEach(function (pt) {
            data.push(pt.value);
            labels.push(pt.label);
            const color = self.data.is_sample ? '#ebebeb' : (pt.type === 'past' ? '#ccbdc8' : (pt.type === 'future' ? '#a5d8d7' : '#ebebeb'));
            backgroundColors.push(color);
        })

        return {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    fill: 'start',
                    label: this.data.label,
                    backgroundColor: backgroundColors,
                }],
            },
            options: {
                legend: {display: false},
                scales: {
                    yAxes: [
                        {
                            display: false,
                            ticks: {
                                beginAtZero: true,
                            },
                        }
                    ],
                },
                maintainAspectRatio: false,
                tooltips: {
                    intersect: false,
                    position: 'nearest',
                    caretSize: 0,
                },
                elements: {
                    line: {
                        tension: 0.000001
                    }
                }
            }
        }
    }

    /**
     * @private
     * @returns {object} Chart config of type 'stacked bar'
     */
    _getStackedBarChartConfig() {
        const self = this;
        const data = [];
        const labels = [];
        const datasets = [];
        const datasets_labels = [];
        const colors = self.data.is_sample ? ['#e7e7e7', '#dddddd', '#f0f0f0', '#fafafa'] : ['#ccbdc8', '#a5d8d7', '#ebebeb', '#ebebeb'];


        _.each(this.graphData, function(graphData, code) {
            datasets_labels.push(code);
            const dataset_data = [];
            graphData.forEach(function (pt) {
                if (!labels.includes(pt.label)) {
                    labels.push(pt.label);
                }
                dataset_data.push(pt.value);
            })
            datasets.push({
                data: dataset_data,
                label: code,
                backgroundColor: colors[datasets_labels.length - 1],
            })
        });


        return {
            type: 'bar',
            data: {
                labels: labels,
                datasets: datasets,
            },
            options: {
                legend: {display: false},
                responsive: true,
                scales: {
                    xAxes: [
                        {
                            stacked: true,
                        }
                    ],
                    yAxes: [
                        {
                            display: false,
                            stacked: true,
                            ticks: {
                                beginAtZero: true,
                            },
                        }
                    ],
                },
                maintainAspectRatio: false,
                tooltips: {
                    intersect: false,
                    position: 'nearest',
                    caretSize: 0,
                },
                elements: {
                    line: {
                        tension: 0.000001
                    }
                }
            }
        }
    }


}

PayrollDashboardStats.template = 'hr_payroll.DashboardStats';
