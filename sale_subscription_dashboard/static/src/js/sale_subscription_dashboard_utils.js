/** @odoo-module **/

import { localization } from "@web/core/l10n/localization";
import { formatMonetary, formatFloat } from "@web/views/fields/formatters";
const { DateTime } = luxon;

const FORMAT_OPTIONS = {
    humanReadable: true,
    digits: 2,
};

export function formatValue(value) {
    return formatFloat(Number(value), FORMAT_OPTIONS);
}

export function getValue(d) { return d[1]; }

export function computeForecastValues(startingValue, projectionTime, growthType, churn, linearGrowth, exponGrowth) {
    const projections = {
        'linear': (val, churn, growth) => val * (1 - churn / 100) + growth,
        'exponential': (val, churn, growth) => val * ( 1 - churn / 100) * (1 + growth / 100)
    }

    const growth = growthType === "linear" ? linearGrowth : exponGrowth;
    const projectionFn = projections[growthType];
    const result = [];
    for (let index = 0; index < projectionTime; index++) {
        const currentDate = DateTime.now().plus({ months: index + 1 });
        const lastValue = !index ? startingValue : getValue(result[index-1]);
        result.push([
            currentDate,
            projectionFn(lastValue, churn, growth),
        ]);
    }
    return result;
}

export function loadChart(element, keyName, result, showLegend, showDemo=false) {

    if (showDemo) {
        // As we do not show legend for demo graphs, we do not care about the dates.
        const yAxis = [10, 20, 29, 37, 44, 50, 55, 59, 62, 64, 65, 66, 67, 68, 69];
        result = yAxis.map(value => ({
            0: "2015-08-01",
            1: value,
        }));
    }

    const labels = [];
    const data = [];
    for (const point of result) {
        labels.push(point[0]);
        data.push(point[1]);
    }

    const datasets = [{
        label: keyName,
        data,
        backgroundColor: "rgba(38,147,213,0.2)",
        borderColor: "rgba(38,147,213,0.8)",
        borderWidth: 3,
        pointBorderWidth: 1,
        cubicInterpolationMode: 'monotone',
        fill: 'origin',
    }];

    if (showLegend) {
        element.style.height = '20em';
    }
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
            labels,
            datasets: datasets,
        },
        options: {
            layout: {
                padding: {bottom: 10},
            },
            legend: {
                display: showLegend,
            },
            maintainAspectRatio: false,
            tooltips: {
                enabled: showLegend,
                intersect: false,
            },
            scales: {
                yAxes: [{
                    scaleLabel: {
                        display: showLegend,
                        labelString: showLegend ? keyName : '',
                    },
                    display: showLegend,
                    type: 'linear',
                    ticks: {
                        callback: formatValue,
                    },
                }],
                xAxes: [{
                    display: showLegend,
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

export function formatMonetaryNumber(value, currencyId) {
    return formatMonetary(value, {
        humanReadable: true,
        currencyId 
    });
}

export function formatNumber(value) {
    return this.isMonetary ?
        formatMonetary(Number(value), {
            ...FORMAT_OPTIONS,
            currencyId: this.state.currency_id,
        }) :
        formatValue(Number(value));
}

export function getColorClass(value, direction) {
    if (value !== 0) {
        if (direction === 'up') {
            return (value > 0) && 'o_green' || 'o_red';
        } else {
            return (value < 0) && 'o_green' || 'o_red';
        }
    }
    return 'o_black';
}

export default {
    getValue,
    formatValue,
    computeForecastValues,
    loadChart,
    getColorClass,
    formatNumber,
    formatMonetaryNumber
};
