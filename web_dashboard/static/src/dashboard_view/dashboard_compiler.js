/** @odoo-module */
import { XMLParser } from "@web/core/utils/xml";
import * as CompileLib from "@web/views/compile/compile_lib";
import { compileGroup, compileWidget } from "@web/views/compile/compile_nodes";

function setSampleDisable(node) {
    CompileLib.appendAttr(node, "class", "o_sample_data_disabled: model.useSampleModel");
}

export class DashboardCompiler {
    constructor(arch) {
        this.doc = new DOMParser().parseFromString("<templates />", "text/xml");
        this.OUTER_GROUP_COL = 6;
        this.nodeIdentifier = CompileLib.nodeIdentifier();
    }

    compileArch(arch) {
        const node = new XMLParser().parseXML(arch);
        const compiled = this.compile(node, {});
        return new XMLSerializer().serializeToString(compiled);
    }

    compile(node, params = {}) {
        const newRoot = this.doc.createElement("t");
        const child = this.compileNode(node, params);
        CompileLib.appendTo(newRoot, child);
        return newRoot;
    }

    compileDashboard(node, params) {
        const dash = this.doc.createElement("div");
        dash.classList.add("o_dashboard_view");
        for (const child of node.children) {
            CompileLib.appendTo(dash, this.compileNode(child, params));
        }
        return dash;
    }

    compileNode(node, params) {
        this.nodeIdentifier(node);
        if (CompileLib.isAlwaysInvisible(node, params)) {
            return;
        }
        switch (node.tagName) {
            case "dashboard":
                return this.compileDashboard(node, params);
            case "group": {
                const group = compileGroup(
                    {
                        compileNode: this.compileNode.bind(this),
                        outerGroupCol: this.OUTER_GROUP_COL,
                        document: this.doc,
                    },
                    { node, compilationContext: params }
                );
                if (node.children.length && node.children[0].tagName === "widget") {
                    group.classList.add("o_has_widget");
                }
                setSampleDisable(group);
                return group;
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
                return compileWidget({ document: this.doc }, { node });
            }
        }
    }

    compileView(node, params) {
        const type = node.getAttribute("type");
        const view = this.doc.createElement("View");

        const divWrap = this.doc.createElement("div");
        divWrap.setAttribute("t-att-type", `"${type}"`);
        divWrap.setAttribute("class", "o_subview");
        setSampleDisable(divWrap);

        CompileLib.appendTo(divWrap, view);

        view.setAttribute("type", `"${type}"`);
        view.setAttribute("t-props", `getViewProps("${type}")`);
        view.setAttribute("t-key", "subViewsRenderKey");
        return divWrap;
    }

    compileStatistic(node, params) {
        const agg = this.doc.createElement("DashboardStatistic");
        let aggName;
        if ("name" in node.attributes) {
            aggName = node.getAttribute("name");
        } else {
            aggName = this.nodeIdentifier.idFor(node);
        }
        const displayName = node.getAttribute("string") || aggName;
        agg.setAttribute("displayName", `"${displayName}"`);
        agg.setAttribute("model", "model");
        agg.setAttribute("name", `"${aggName}"`);
        agg.setAttribute("statisticType", `"${node.tagName}"`);

        if ("value_label" in node.attributes) {
            agg.setAttribute("valueLabel", `"${node.getAttribute("value_label")}"`);
        }

        if ("widget" in node.attributes) {
            agg.setAttribute("widget", `"${node.getAttribute("widget")}"`);
        }

        if ("help" in node.attributes) {
            agg.setAttribute("help", `"${node.getAttribute("help")}"`);
        }

        const modifiers = CompileLib.getAllModifiers(node);
        if (modifiers) {
            agg.setAttribute("modifiers", `"${CompileLib.encodeObjectForTemplate(modifiers)}"`);
        }

        if (node.tagName === "aggregate") {
            let clickable;
            if (!("clickable" in node.attributes)) {
                clickable = true;
            } else {
                clickable = CompileLib.getModifier(node, "clickable");
            }
            if (clickable) {
                agg.setAttribute("t-on-change-statistic", `onStatisticChange("${aggName}")`);
            }
            agg.setAttribute("clickable", `model.evalDomain(record, ${clickable})`);
        }
        let compiled = agg;
        if (params.groupLevel) {
            const div = this.doc.createElement("div");
            div.setAttribute("class", "o_aggregate_col");
            CompileLib.appendTo(div, agg);
            compiled = div;
        }
        return CompileLib.applyInvisibleModifier({ node, compiled }, params);
    }
}
