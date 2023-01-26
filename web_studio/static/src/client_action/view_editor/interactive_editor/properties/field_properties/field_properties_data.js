/** @odoo-module **/

import { _lt, _t } from "@web/core/l10n/translation";

export const FIELD_PROPERTIES = {
    context: {
        name: "context",
        string: _lt("Context"),
        type: "string",
        getValue(node) {
            return node.attrs.context || JSON.stringify(node.field.context || {});
        },
        isNodeAttribute: true,
    },
    domain: {
        name: "domain",
        string: _lt("Domain"),
        type: "domain",
        getValue(node) {
            return {
                domain: node.attrs.domain,
                relation: node.field.relation,
            };
        },
        isNodeAttribute: true,
    },
    no_create: {
        name: "no_create",
        string: _lt("Disable creation"),
        type: "boolean",
    },
    no_open: {
        name: "no_open",
        string: _lt("Disable opening"),
        type: "boolean",
    },
    aggregate: {
        name: "aggregate",
        string: _lt("Aggregate"),
        type: "selection",
        isNodeAttribute: true,
        getChoices() {
            return [
                { value: "sum", label: _t("Sum") },
                { value: "avg", label: _t("Average") },
                { value: "none", label: _t("No aggregation") },
            ];
        },
        getValue(node) {
            const attrs = node.attrs;
            return attrs.sum ? "sum" : attrs.avg ? "avg" : "none";
        },
    },
};
