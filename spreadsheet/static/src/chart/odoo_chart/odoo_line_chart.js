/** @odoo-module */

import spreadsheet from "@spreadsheet/o_spreadsheet/o_spreadsheet_extended";
import { _t } from "@web/core/l10n/translation";
import { OdooChart } from "./odoo_chart";

const { chartRegistry } = spreadsheet.registries;

const { getDefaultChartJsRuntime, chartFontColor, ChartColors } = spreadsheet.helpers;

export class OdooLineChart extends OdooChart {
    constructor(definition, sheetId, getters) {
        super(definition, sheetId, getters);
        this.verticalAxisPosition = definition.verticalAxisPosition;
    }

    getDefinition() {
        return {
            ...super.getDefinition(),
            verticalAxisPosition: this.verticalAxisPosition,
        };
    }
}

chartRegistry.add("odoo_line", {
    match: (type) => type === "odoo_line",
    createChart: (definition, sheetId, getters) => new OdooLineChart(definition, sheetId, getters),
    getChartRuntime: createOdooChartRuntime,
    validateChartDefinition: (validator, definition) =>
        OdooLineChart.validateChartDefinition(validator, definition),
    transformDefinition: (definition) => OdooLineChart.transformDefinition(definition),
    getChartDefinitionFromContextCreation: () => OdooLineChart.getDefinitionFromContextCreation(),
    name: _t("Line"),
});

function createOdooChartRuntime(chart, getters) {
    const model = getters.getSpreadsheetGraphModel(chart.id);
    if (!model) {
        return getLineConfiguration(chart, []);
    }
    const { datasets, labels } = model.data;
    const runtime = getLineConfiguration(chart, labels);
    const colors = new ChartColors();
    for (let { label, data } of datasets) {
        const color = colors.next();
        const dataset = {
            label,
            data,
            lineTension: 0,
            borderColor: color,
            backgroundColor: color,
        };
        runtime.data.datasets.push(dataset);
    }

    return runtime;
}

function getLineConfiguration(chart, labels) {
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
    return config;
}
