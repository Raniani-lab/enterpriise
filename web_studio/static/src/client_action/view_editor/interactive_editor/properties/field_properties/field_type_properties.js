/** @odoo-module */

import { _t } from "@web/core/l10n/translation";

/**
 * This object describes the properties editable in studio, depending on
 * one or more attribute of a field. The TypeWidgetProperties component will
 * retrieve the value by itself, or you can set a function with the `getValue`
 * key to compute it specifically for one editable property.
 */
export const EDITABLE_ATTRIBUTES = {
    context: {
        name: "context",
        label: _t("Context"),
        type: "string",
    },
    domain: {
        name: "domain",
        label: _t("Domain"),
        type: "domain",
        getValue({ attrs, field }) {
            return {
                domain: attrs.domain,
                relation: field.relation,
            };
        },
    },
    aggregate: {
        name: "aggregate",
        label: _t("Aggregate"),
        type: "selection",
        choices: [
            { value: "sum", label: _t("Sum") },
            { value: "avg", label: _t("Average") },
            { value: "none", label: _t("No aggregation") },
        ],
        getValue({ attrs }) {
            return attrs.sum ? "sum" : attrs.avg ? "avg" : "none";
        },
    },
    placeholder: {
        name: "placeholder",
        label: _t("Placeholder"),
        type: "string",
    },
};

export const FIELD_TYPE_ATTRIBUTES = {
    char: {
        common: [EDITABLE_ATTRIBUTES.placeholder],
    },
    date: {
        common: [EDITABLE_ATTRIBUTES.placeholder],
    },
    datetime: {
        common: [EDITABLE_ATTRIBUTES.placeholder],
    },
    float: {
        common: [EDITABLE_ATTRIBUTES.placeholder],
        list: [EDITABLE_ATTRIBUTES.aggregate],
    },
    html: {
        common: [EDITABLE_ATTRIBUTES.placeholder],
    },
    integer: {
        common: [EDITABLE_ATTRIBUTES.placeholder],
        list: [EDITABLE_ATTRIBUTES.aggregate],
    },
    many2many: {
        common: [EDITABLE_ATTRIBUTES.domain, EDITABLE_ATTRIBUTES.context],
    },
    many2one: {
        common: [
            EDITABLE_ATTRIBUTES.domain,
            EDITABLE_ATTRIBUTES.context,
            EDITABLE_ATTRIBUTES.placeholder,
        ],
    },
    monetary: {
        common: [EDITABLE_ATTRIBUTES.placeholder],
        list: [EDITABLE_ATTRIBUTES.aggregate],
    },
    selection: {
        common: [EDITABLE_ATTRIBUTES.placeholder],
    },
};
