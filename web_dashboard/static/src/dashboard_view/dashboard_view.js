/** @odoo-module **/

import { registry } from "@web/core/registry";
import { useEffect, useService } from "@web/core/utils/hooks";
import { deepCopy } from "@web/core/utils/objects";
import { capitalize, sprintf } from "@web/core/utils/strings";
import { XMLParser } from "@web/core/utils/xml";
import { ControlPanel } from "@web/search/control_panel/control_panel";
import { SearchPanel } from "@web/search/search_panel/search_panel";
import * as CompileLib from "@web/views/compile/compile_lib";
import { useModel } from "@web/views/helpers/model";
import { standardViewProps } from "@web/views/helpers/standard_view_props";
import { useSetupView, useViewArch } from "@web/views/helpers/view_hook";
import { View } from "@web/views/view";
import { ViewWidget } from "@web/views/view_widget";
import { CallbackRecorder } from "@web/webclient/actions/action_hook";
import { ControlPanelBottomContent } from "./control_panel_bottom_content/control_panel_bottom_content";
import { DashboardCompiler } from "./dashboard_compiler";
import { DashboardModel } from "./dashboard_model";
import { DashboardStatistic } from "./dashboard_statistic/dashboard_statistic";

const { Component, hooks } = owl;
const { useSubEnv } = hooks;

const viewRegistry = registry.category("views");

const SUB_VIEW_CONTROL_PANEL_DISPLAY = {
    "bottom-right": false,
    "top-left": false,
    "top-right": false, // --> top: false
};

const GRAPH_DISPLAY = {
    "bottom-right": false,
    legend: true,
    scaleLabels: false,
};

const DISPLAY = {
    graph: GRAPH_DISPLAY,
};

const SUPPORTED_VIEW_TYPES = ["graph", "pivot", "cohort"];

class DashboardArchParser extends XMLParser {
    parse(arch, fields) {
        const subViews = {};
        const aggregates = [];
        const formulae = [];
        const nodeIdentifier = CompileLib.nodeIdentifier();
        let viewAppearanceIndex = 0;

        this.visitXML(arch, (node) => {
            if (node.tagName === "view") {
                const type = node.getAttribute("type");
                if (!SUPPORTED_VIEW_TYPES.includes(type)) {
                    throw new Error(`Unsupported viewtype "${type}" in DashboardView`);
                }
                if (type in subViews) {
                    throw new Error(
                        `multiple views of the same type is not allowed. Duplicated type: "${type}".`
                    );
                }
                const ref = node.getAttribute("ref") || false;
                subViews[type] = { ref, index: viewAppearanceIndex++ };
            }
            if (node.tagName === "aggregate") {
                const fieldName = node.getAttribute("field");
                let groupOperator = node.getAttribute("group_operator");
                // in the dashboard views, many2one fields are fetched with the
                // group_operator 'count_distinct', which means that the values
                // manipulated client side for these fields are integers

                //TO DO: Discuss with LPE: on legacy we also change the type of the field : field.type = 'integer';
                if (fields[fieldName].type === "many2one") {
                    groupOperator = "count_distinct";
                }

                let measure = node.getAttribute("measure");
                if (measure && measure === "__count__") {
                    measure = "__count";
                }
                aggregates.push({
                    name: node.getAttribute("name"),
                    field: fieldName,
                    domain: node.getAttribute("domain"),
                    domainLabel:
                        node.getAttribute("domain_label") ||
                        node.getAttribute("string") ||
                        node.getAttribute("name"),
                    measure: measure || fieldName,
                    groupOperator,
                });
            }
            if (node.tagName === "formula") {
                nodeIdentifier(node);
                formulae.push({
                    name: node.getAttribute("name") || nodeIdentifier.idFor(),
                    operation: node.getAttribute("value"),
                    domain: node.getAttribute("domain"),
                });
            }
        });
        return { subViews, aggregates, formulae };
    }
}

export class DashboardView extends Component {
    setup() {
        this._viewService = useService("view");
        this.action = useService("action");
        this.subViewsRenderKey = 1;

        const { resModel, info, arch, fields, state } = this.props;
        const processedArch = useViewArch(arch, {
            compile: (arch) => new DashboardCompiler().compileArch(arch),
            extract: (arch) => new DashboardArchParser().parse(arch, fields),
        });

        this.template = processedArch.template;
        const { subViews, aggregates, formulae } = processedArch.extracted;
        this.subViews = Object.assign({}, subViews, this.props.state && this.props.state.subViews);
        this.aggregates = aggregates;
        this.formulae = formulae;

        this.__exportGlobalState__ = new CallbackRecorder();
        this.__exportLocalState__ = new CallbackRecorder();
        this.__saveParams__ = new CallbackRecorder();

        useSetupView({
            exportLocalState: () => {
                const subViews = this.exportSubviewsState();
                for (const [viewType, viewInfo] of Object.entries(subViews)) {
                    delete viewInfo.props.state.domain;
                    delete viewInfo.props.state.domains;
                    delete viewInfo.props.domains;
                    delete viewInfo.props.globalState;
                }
                return {
                    subViews,
                    useSampleModel: this.model.meta.useSampleModel,
                };
            },
            saveParams: () => {
                return {
                    context: this.saveParamsSubviews(),
                };
            },
        });
        // cannot be above useSetupAction: ok with that?
        useSubEnv({
            __exportGlobalState__: this.__exportGlobalState__,
            __exportLocalState__: this.__exportLocalState__,
            __saveParams__: this.__saveParams__,
        });

        const useSampleModel = state ? state.useSampleModel : this.props.useSampleModel;
        this.model = useModel(DashboardModel, {
            resModel,
            fields,
            useSampleModel,
            aggregates: this.aggregates,
            formulae: this.formulae,
        });

        // Always renew every view
        useEffect(() => {
            this.subViewsRenderKey++;
        });
    }

    saveParamsSubviews() {
        const { subViews } = this;
        const result = {};
        for (const [viewType, subView] of Object.entries(subViews)) {
            const c = this.__saveParams__._callbacks.find(
                (c) => c.owner.constructor.type === viewType
            );
            if (c) {
                result[viewType] = c.callback().context;
            }
        }
        // we will need some kind of reconciliation: arch and thus subViews can change without the ir filter stay the same!
        return result;
    }

    exportSubviewsGlobalState() {
        const globalStates = {};

        for (const [viewType, subView] of Object.entries(this.subViews)) {
            const { callback } = this.__exportGlobalState__._callbacks[subView.index];
            globalStates[viewType] = callback();
        }
        return globalStates;
    }

    exportSubviewsState() {
        const subViews = {};
        for (let [viewType, subView] of Object.entries(this.subViews)) {
            subView = deepCopy(subView);
            subViews[viewType] = subView;
            const c = this.__exportLocalState__._callbacks.find(
                (c) => c.owner.constructor.type === viewType
            );
            if (c) {
                subView.props.state = c.callback();
            }
        }
        return subViews;
    }

    async willStart() {
        let loadViewProms = [];
        let additionalMeasures = this.aggregates.map((a) => a.field);

        const allViews = Object.entries(this.subViews);
        if (!allViews.length) {
            return;
        }
        const resModel = this.props.resModel;
        const loadViewsContext = Object.assign({}, this.props.context);
        const falseRefs = {
            context: {},
            views: [],
        };
        const withRefs = {
            context: {},
            views: [],
        };

        // group loadViews: false on the one side, and each ref on its own
        for (const [type, { ref }] of allViews) {
            if (!ref) {
                falseRefs.views.push([false, type]);
            } else {
                const viewRef = `${type}_view_ref`;
                withRefs.views.push([false, type]);
                withRefs.context[viewRef] = ref;
            }
        }

        [falseRefs, withRefs].forEach((params) => {
            const views = params.views;
            if (!views.length) {
                return;
            }
            const context = Object.assign(loadViewsContext, params.context);
            loadViewProms.push(
                this._viewService
                    .loadViews({ context, views, resModel }, {})
                    .then((viewDescriptions) => {
                        Object.entries(viewDescriptions).forEach(([type, viewInfo]) => {
                            const subView = this.subViews[type];
                            if (!subView) {
                                return;
                            }
                            const context = Object.assign(
                                this.props.context,
                                this.props.context[type] || {}
                            );
                            delete context[type];
                            const { viewId, arch, fields } = viewInfo;
                            subView.props = Object.assign(subView.props || {}, {
                                viewId,
                                arch,
                                fields,
                                additionalMeasures,
                                context,
                            });
                        });
                    })
            );
        });

        await Promise.all(loadViewProms);
    }

    openFullscreen(viewType) {
        let localState;
        const c = this.__exportLocalState__._callbacks.find(
            (c) => c.owner.constructor.type === viewType
        );
        if (c) {
            localState = c.callback();
        }

        const action = {
            domain: this.env.searchModel.globalDomain,
            context: this.props.context,
            name: sprintf(this.env._t("%s Analysis"), capitalize(viewType)),
            res_model: this.model.meta.resModel,
            type: "ir.actions.act_window",
            views: [[false, viewType]],
            useSampleModel: false, // disable sample data when zooming on a sub view
        };

        this.action.doAction(action, {
            props: {
                state: localState,
                globalState: { searchModel: JSON.stringify(this.env.searchModel.exportState()) },
            },
        });
    }

    getViewProps(type) {
        const display = Object.assign(DISPLAY[type] || {});
        display.controlPanel = Object.assign({}, SUB_VIEW_CONTROL_PANEL_DISPLAY, {
            "bottom-content": {
                Component: ControlPanelBottomContent,
                props: {
                    switchView: () => this.openFullscreen(type),
                },
            },
        });
        const subView = this.subViews[type];
        const props = Object.assign(
            {},
            {
                domain: this.props.domain,
                domains: this.props.domains,
                resModel: this.props.resModel,
                display: display,
                context: Object.assign({}, this.props.context),
                searchViewArch: this.props.info.searchViewArch,
                searchViewFields: this.props.info.searchViewFields,
            },
            subView.props,
            {
                noContentHelp: this.model.meta.useSampleModel ? false : undefined,
                useSampleModel: this.model.meta.useSampleModel,
            }
        );

        return props;
    }

    getCurrentMeasure() {
        if (!this.currentMeasure) {
            return null;
        }
        const measure = this.currentMeasure;
        return {
            default: { measure },
            pivot: { activeMeasures: [measure] },
        };
    }

    /**
     * @param {Object} nextProps
     */
    async willUpdateProps(nextProps) {
        const subViews = this.exportSubviewsState();
        const currentMeasure = this.getCurrentMeasure();

        Object.entries(subViews).forEach(([viewType, { props }]) => {
            if (viewType === "graph") {
                props.state = Object.assign(
                    props.state || {},
                    currentMeasure && currentMeasure.default
                );
            } else if (viewType === "cohort") {
                props.state = Object.assign(
                    props.state || {},
                    currentMeasure && currentMeasure.default
                );
            } else if (viewType === "pivot") {
                props.state = Object.assign(props.state || {});
                props.state.meta = Object.assign(
                    props.state.meta || {},
                    currentMeasure && currentMeasure.pivot
                );
            }
        });
        this.subViews = subViews;

        const { domains } = nextProps;
        for (const [type, subView] of Object.entries(this.subViews)) {
            const context = Object.assign(nextProps.context, nextProps.context[type] || {});
            delete context[type];
            Object.assign(subView.props, { context, domains });
        }

        const globalStates = this.exportSubviewsGlobalState();
        for (const [type, subView] of Object.entries(this.subViews)) {
            subView.props = Object.assign({}, subView.props, { globalState: globalStates[type] });
        }
    }

    onStatisticChange(statName) {
        const stat = this.model.getStatisticDescription(statName);
        this.currentMeasure = stat.measure;

        if (stat.domain) {
            this.env.searchModel.setDomainParts({
                dashboardMeasure: {
                    domain: stat.domain,
                    facetLabel: stat.domainLabel,
                },
            });
        } else {
            this.env.searchModel.setDomainParts({ dashboardMeasure: null });
        }
    }
}
DashboardView.template = "web_dashboard.DashboardView";
DashboardView.props = {
    ...standardViewProps,
    display: Object,
};
DashboardView.defaultProps = {
    display: {},
};

DashboardView.components = { ControlPanel, SearchPanel, View, DashboardStatistic, ViewWidget };

DashboardView.type = "dashboard";

DashboardView.display_name = "dashboard";
DashboardView.icon = "fa-tachometer";
DashboardView.multiRecord = true;

DashboardView.searchMenuTypes = ["filter", "comparison", "favorite"];

viewRegistry.add("dashboard", DashboardView);
