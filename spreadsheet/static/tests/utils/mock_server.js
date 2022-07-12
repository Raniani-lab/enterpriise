/** @odoo-module */

import { registry } from "@web/core/registry";

registry
    .category("mock_server")
    .add("res.currency/get_currencies_for_spreadsheet", function (route, args) {
        const currencyNames = args.args[0];
        const result = [];
        for (let currencyName of currencyNames) {
            const curr = this.models["currency"].records.find(
                (curr) => curr.name === currencyName
            );

            result.push({
                code: curr.name,
                symbol: curr.symbol,
                decimalPlaces: curr.decimal_places || 2,
                position: curr.position || "after",
            });
        }
        return result;
    });
