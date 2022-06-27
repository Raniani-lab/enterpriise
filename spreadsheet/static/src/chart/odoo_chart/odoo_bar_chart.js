/** @odoo-module */

import spreadsheet from "@spreadsheet/o_spreadsheet/o_spreadsheet_extended";
import { _t } from "@web/core/l10n/translation";
import { OdooChart } from "./odoo_chart";

const { chartRegistry } = spreadsheet.registries;

const { getDefaultChartJsRuntime, chartFontColor, ChartColors } = spreadsheet.helpers;

export class OdooBarChart extends OdooChart {
    constructor(definition, sheetId, getters) {
        super(definition, sheetId, getters);
        this.verticalAxisPosition = definition.verticalAxisPosition;
        this.stacked = definition.stacked;
    }

    getDefinition() {
        return {
            ...super.getDefinition(),
            verticalAxisPosition: this.verticalAxisPosition,
            stacked: this.stacked,
        };
    }
}

chartRegistry.add("odoo_bar", {
    match: (type) => type === "odoo_bar",
    createChart: (definition, sheetId, getters) => new OdooBarChart(definition, sheetId, getters),
    getChartRuntime: createOdooChartRuntime,
    validateChartDefinition: (validator, definition) =>
        OdooBarChart.validateChartDefinition(validator, definition),
    transformDefinition: (definition) => OdooBarChart.transformDefinition(definition),
    getChartDefinitionFromContextCreation: () => OdooBarChart.getDefinitionFromContextCreation(),
    name: _t("Bar"),
});

function createOdooChartRuntime(chart, getters) {
    const model = getters.getSpreadsheetGraphModel(chart.id);
    if (!model) {
        return getBarConfiguration(chart, []);
    }
    const { datasets, labels } = model.data;
    const runtime = getBarConfiguration(chart, labels);
    const colors = new ChartColors();
    for (let { label, data } of datasets) {
        const color = colors.next();
        const dataset = {
            label,
            data,
            borderColor: color,
            backgroundColor: color,
        };
        runtime.data.datasets.push(dataset);
    }

    return runtime;
}

function getBarConfiguration(chart, labels) {
    const fontColor = chartFontColor(chart.background);
    const config = getDefaultChartJsRuntime(chart, labels, fontColor);
    config.type = chart.type.replace("odoo_", "");
    const legend = {
        labels: { fontColor },
    };
    legend.position = chart.legendPosition;
    config.options.legend = legend;
    config.options.layout = {
        padding: { left: 20, right: 20, top: chart.title ? 10 : 25, bottom: 10 },
    };
    config.options.scales = {
        xAxes: [
            {
                ticks: {
                    // x axis configuration
                    maxRotation: 60,
                    minRotation: 15,
                    padding: 5,
                    labelOffset: 2,
                    fontColor,
                },
            },
        ],
        yAxes: [
            {
                position: chart.verticalAxisPosition,
                ticks: {
                    fontColor,
                    // y axis configuration
                    beginAtZero: true, // the origin of the y axis is always zero
                },
            },
        ],
    };
    if (chart.stacked) {
        config.options.scales.xAxes[0].stacked = true;
        config.options.scales.yAxes[0].stacked = true;
    }
    return config;
}
