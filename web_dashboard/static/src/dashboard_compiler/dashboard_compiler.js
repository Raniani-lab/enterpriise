/** @odoo-module */

import { createElement, XMLParser } from "@web/core/utils/xml";
import { toStringExpression } from "@web/views/utils";
import {
    assignOwlDirectives,
    encodeObjectForTemplate,
    isComponentNode,
} from "@web/views/view_compiler";
import {
    appendTo,
    applyInvisibleModifier,
    getModifier,
    isAlwaysInvisible,
    makeNodeIdentifier,
} from "./compile_helpers";

/**
 * An object containing various information about the current
 * compilation from an Arch to a owl template.
 * @typedef {Object} CompilationContext
 */

/**
 * If a group node has a string, compile a title div for it
 * @param  {Element} node an arch's node
 * @return {Element}
 */
function makeGroupTitleRow(node) {
    const titleDiv = createElement("div");
    titleDiv.classList.add("o_horizontal_separator");
    titleDiv.textContent = node.getAttribute("string");
    return titleDiv;
}

/**
 * Compiles a template node for a `<group>`arch's node. Only for first level
 * @param {Object} config
 * @param  {Function} config.compileNode   A function to compile children nodes
 * @param  {number} [config.outerGroupCol] the default group column
 * @param {Object} params The execution parameters
 * @param  {Element} params.node An arch's node
 * @param  {CompilationContext} params.compilationContext
 * @return {Element} The compiled group node
 */
function compileGroup({ compileNode, outerGroupCol }, { node, compilationContext }) {
    outerGroupCol = outerGroupCol || 2;

    const group = createElement("div");
    group.setAttribute("class", "o_group");

    if (node.hasAttribute("string")) {
        appendTo(group, makeGroupTitleRow(node));
    }

    const nbCols =
        "col" in node.attributes ? parseInt(node.getAttribute("col"), 10) : outerGroupCol;
    const colSize = Math.max(1, Math.round(12 / nbCols));

    compilationContext = Object.create(compilationContext);
    compilationContext.groupLevel = (compilationContext.groupLevel || 1) + 1;
    for (const child of node.children) {
        if (child.tagName === "newline") {
            appendTo(group, createElement("br"));
            continue;
        }
        const compiled = compileNode(child, compilationContext);
        if (!compiled) {
            continue;
        }
        const colspan =
            "colspan" in child.attributes ? parseInt(node.getAttribute("colspan"), 10) : 1;
        const className = `o_group_col_${colSize * colspan}`;

        if (isComponentNode(compiled)) {
            const classList = compiled.getAttribute("class") || "''";
            compiled.setAttribute("class", classList.replace(/'$/, ` ${className}'`).trim());
        } else {
            compiled.classList.add(className);
        }
        appendTo(group, compiled);
    }
    return group;
}

/**
 * Compiles a template node for a `<widget>`arch's node
 * @param {Element} el An arch's node
 * @return {Element} The compiled Widget node
 */
function compileWidget(el) {
    const attrs = {};
    const props = { record: "model.records[0]" };
    for (const { name, value } of el.attributes) {
        if (name === "name") {
            props.name = `'${value}'`;
        } else if (name === "modifiers") {
            attrs.modifiers = JSON.parse(value || "{}");
        } else {
            attrs[name] = value;
        }
    }
    props.node = encodeObjectForTemplate({ attrs });
    const widget = createElement("Widget", props);
    return assignOwlDirectives(widget, el);
}

export class DashboardCompiler {
    constructor() {
        this.OUTER_GROUP_COL = 6;
        this.nodeIdentifier = makeNodeIdentifier();
    }

    compileArch(arch) {
        const node = new XMLParser().parseXML(arch);
        const compiled = this.compile(node, {});
        return new XMLSerializer().serializeToString(compiled);
    }

    compile(node, params = {}) {
        const newRoot = createElement("t");
        const child = this.compileNode(node, params);
        appendTo(newRoot, child);
        return newRoot;
    }

    compileDashboard(node, params) {
        const dash = createElement("t");
        for (const child of node.children) {
            appendTo(dash, this.compileNode(child, params));
        }
        return dash;
    }

    compileNode(node, params) {
        this.nodeIdentifier.add(node);
        if (isAlwaysInvisible(node, params)) {
            return;
        }
        switch (node.tagName) {
            case "dashboard": {
                return this.compileDashboard(node, params);
            }
            case "group": {
                return this.compileGroup(node, params);
            }
            case "aggregate": {
                return this.compileStatistic(node, params);
            }
            case "view": {
                return this.compileView(node, params);
            }
            case "formula": {
                return this.compileStatistic(node, params);
            }
            case "widget": {
                return compileWidget(node);
            }
        }
    }

    compileGroup(node, params) {
        const group = compileGroup(
            {
                compileNode: this.compileNode.bind(this),
                outerGroupCol: this.OUTER_GROUP_COL,
            },
            { node, compilationContext: params }
        );
        if (node.children.length && node.children[0].tagName === "widget") {
            group.classList.add("o_has_widget");
        }
        return group;
    }

    compileView(node) {
        const view = createElement("ViewWrapper");
        const type = node.getAttribute("type");
        view.setAttribute("t-props", `this.getViewWrapperProps('${type}')`);
        view.setAttribute("t-key", "renderKey");
        return view;
    }

    compileStatistic(node, params) {
        const agg = createElement("DashboardStatistic");
        let aggName;
        if ("name" in node.attributes) {
            aggName = node.getAttribute("name");
        } else {
            aggName = this.nodeIdentifier.idFor(node);
        }
        const displayName = node.getAttribute("string") || aggName;
        agg.setAttribute("displayName", toStringExpression(displayName));
        agg.setAttribute("model", "model");
        agg.setAttribute("name", `"${aggName}"`);
        agg.setAttribute("statisticType", `"${node.tagName}"`);
        agg.setAttribute("t-key", "renderKey");

        if ("value_label" in node.attributes) {
            agg.setAttribute("valueLabel", toStringExpression(node.getAttribute("value_label")));
        }

        if ("widget" in node.attributes) {
            agg.setAttribute("widget", `"${node.getAttribute("widget")}"`);
        }

        if ("help" in node.attributes) {
            agg.setAttribute("help", toStringExpression(node.getAttribute("help")));
        }

        const modifiers = node.getAttribute("modifiers");
        if (modifiers) {
            agg.setAttribute("modifiers", encodeObjectForTemplate(JSON.parse(modifiers)));
        }

        if (node.tagName === "aggregate") {
            let clickable;
            if (!("clickable" in node.attributes)) {
                clickable = true;
            } else {
                clickable = getModifier(node, "clickable");
            }
            agg.setAttribute(
                "onStatisticChange",
                `model.evalDomain(record, ${clickable}) and onStatisticChange.bind(this, "${aggName}") or (() => {})`
            );
            agg.setAttribute("clickable", `model.evalDomain(record, ${clickable})`);
        }
        let compiled = agg;
        if (params.groupLevel) {
            const div = createElement("div", { class: "o_aggregate_col" });
            appendTo(div, agg);
            compiled = div;
        }
        return applyInvisibleModifier({ node, compiled }, params);
    }
}
