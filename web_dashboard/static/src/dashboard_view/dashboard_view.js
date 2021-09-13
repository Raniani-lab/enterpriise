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
import { OnboardingBanner } from "@web/views/onboarding_banner";

const { Component, hooks, tags } = owl;
const { useSubEnv } = hooks;

const viewRegistry = registry.category("views");

const SUB_VIEW_CONTROL_PANEL_DISPLAY = {
    "bottom-right": false,
    "top-left": false,
    "top-right": false, // --> top: false
    adaptToScroll: false,
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
        const subViewRefs = {};
        const aggregates = [];
        const formulae = [];
        const nodeIdentifier = CompileLib.nodeIdentifier();

        this.visitXML(arch, (node) => {
            if (node.tagName === "view") {
                const type = node.getAttribute("type");
                if (!SUPPORTED_VIEW_TYPES.includes(type)) {
                    throw new Error(`Unsupported viewtype "${type}" in DashboardView`);
                }
                if (type in subViewRefs) {
                    throw new Error(
                        `multiple views of the same type is not allowed. Duplicated type: "${type}".`
                    );
                }
                subViewRefs[type] = node.getAttribute("ref") || false;
            }
            if (node.tagName === "aggregate") {
                const fieldName = node.getAttribute("field");
                const field = fields[fieldName];
                let groupOperator = node.getAttribute("group_operator");

                if (!groupOperator && field.group_operator) {
                    groupOperator = field.group_operator;
                }
                // in the dashboard views, many2one fields are fetched with the
                // group_operator 'count_distinct', which means that the values
                // manipulated client side for these fields are integers

                //TO DO: Discuss with LPE: on legacy we also change the type of the field : field.type = 'integer';
                if (field.type === "many2one") {
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
        return { subViewRefs, aggregates, formulae };
    }
}

// The ViewWrapper component is an higher order component for sub views in the
// dashboard. It allows to define a specific env for each sub view, with their
// own callback recorders such that the dashboard can get their local and global
// states, and their context.
class ViewWrapper extends Component {
    setup() {
        useSubEnv(this.props.callbackRecorders);
    }
}
ViewWrapper.template = tags.xml`<View t-props="props.viewProps"/>`;
ViewWrapper.components = { View };

export class DashboardView extends Component {
    setup() {
        this._viewService = useService("view");
        this.action = useService("action");
        this.subViewsRenderKey = 1;

        const { resModel, arch, fields } = this.props;
        const processedArch = useViewArch(arch, {
            compile: (arch) => new DashboardCompiler().compileArch(arch),
            extract: (arch) => new DashboardArchParser().parse(arch, fields),
        });

        this.template = processedArch.template;
        const { subViewRefs, aggregates, formulae } = processedArch.extracted;
        this.subViews = {};
        Object.keys(subViewRefs).forEach((viewType) => {
            this.subViews[viewType] = {
                ref: subViewRefs[viewType],
                callbackRecorders: {
                    __exportLocalState__: new CallbackRecorder(),
                    __exportGlobalState__: new CallbackRecorder(),
                    __saveParams__: new CallbackRecorder(),
                },
                props: null, // will be generated after the loadViews
            };
            if (this.props.state) {
                this.subViews[viewType].state = this.props.state.subViews[viewType];
            }
        });
        this.aggregates = aggregates;
        this.formulae = formulae;

        useSetupView({
            exportLocalState: () => {
                return {
                    subViews: this.callRecordedCallbacks("__exportLocalState__"),
                };
            },
            saveParams: () => {
                return {
                    context: this.callRecordedCallbacks("__saveParams__"),
                };
            },
        });

        this.model = useModel(DashboardModel, {
            resModel,
            fields,
            aggregates: this.aggregates,
            formulae: this.formulae,
        });

        // Always renew every view
        useEffect(() => {
            this.subViewsRenderKey++;
        });
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
                            subView.props = {
                                viewId,
                                arch,
                                fields,
                                additionalMeasures,
                                context,
                                type,
                            };
                        });
                    })
            );
        });

        await Promise.all(loadViewProms);
    }

    async willUpdateProps(nextProps) {
        if (this.currentMeasure) {
            const states = this.callRecordedCallbacks("__exportLocalState__");
            Object.entries(this.subViews).forEach(([viewType, subView]) => {
                subView.state = states[viewType];
                if (viewType === "graph") {
                    subView.state.metaData = Object.assign({}, subView.state.metaData);
                    subView.state.metaData.measure = this.currentMeasure;
                } else if (viewType === "cohort") {
                    subView.state.measure = this.currentMeasure;
                } else if (viewType === "pivot") {
                    subView.state.metaData = Object.assign({}, subView.state.metaData);
                    subView.state.metaData.activeMeasures = [this.currentMeasure];
                }
            });
        }

        const { comparison, domain } = nextProps;
        for (const [type, subView] of Object.entries(this.subViews)) {
            const context = Object.assign(nextProps.context, nextProps.context[type] || {});
            delete context[type];
            Object.assign(subView.props, { comparison, context, domain });
        }

        const globalStates = this.callRecordedCallbacks("__exportGlobalState__");
        for (const [type, subView] of Object.entries(this.subViews)) {
            subView.props = Object.assign({}, subView.props, { globalState: globalStates[type] });
        }
    }

    /**
     * Calls a type of recorded callbacks and aggregates their result.
     * @param {"__saveParams__"|"__exportLocalState__"|"__exportGlobalState__"} name
     * @returns {Object}
     */
    callRecordedCallbacks(name) {
        const result = {};
        for (const [viewType, subView] of Object.entries(this.subViews)) {
            const callbacks = subView.callbackRecorders[name]._callbacks;
            if (callbacks.length) {
                result[viewType] = callbacks.reduce((res, c) => {
                    // FIXME: we'll stop exporting a dict with a context key, but directly export
                    // the context instead. When this will be done, we'll get rid of this hack
                    const cbRes = name === "__saveParams__" ? c.callback().context : c.callback();
                    return { ...res, ...cbRes };
                }, {});
            }
        }
        return result;
    }

    /**
     * Returns the props of the ViewWrapper components.
     * @param {string} viewType
     * @returns {Object}
     */
    getViewWrapperProps(viewType) {
        return {
            callbackRecorders: this.subViews[viewType].callbackRecorders,
            viewProps: this.getViewProps(viewType),
        };
    }

    /**
     * Returns the props to pass to the sub view of the given type.
     * @param {string} viewType
     * @returns {Object}
     */
    getViewProps(viewType) {
        const display = Object.assign(DISPLAY[viewType] || {});
        display.controlPanel = Object.assign({}, SUB_VIEW_CONTROL_PANEL_DISPLAY, {
            "bottom-content": {
                Component: ControlPanelBottomContent,
                props: {
                    switchView: () => this.openFullscreen(viewType),
                },
            },
        });
        const subView = this.subViews[viewType];
        const props = Object.assign(
            {
                domain: this.props.domain,
                comparison: this.props.comparison,
                resModel: this.props.resModel,
                display: display,
                context: Object.assign({}, this.props.context),
                searchViewArch: this.props.info.searchViewArch,
                searchViewFields: this.props.info.searchViewFields,
                type: viewType,
            },
            subView.props,
            {
                noContentHelp: this.model.useSampleModel ? false : undefined,
                useSampleModel: this.model.useSampleModel,
            },
            { state: subView.state }
        );

        return props;
    }

    /**
     * Opens the requested view in an other action, so that it is displayed in
     * full screen.
     * @param {string} viewType
     * @returns {Promise}
     */
    openFullscreen(viewType) {
        const action = {
            domain: this.env.searchModel.globalDomain,
            context: this.props.context,
            name: sprintf(this.env._t("%s Analysis"), capitalize(viewType)),
            res_model: this.model.meta.resModel,
            type: "ir.actions.act_window",
            views: [[false, viewType]],
            useSampleModel: false, // disable sample data when zooming on a sub view
        };

        return this.action.doAction(action, {
            props: {
                state: this.callRecordedCallbacks("__exportLocalState__")[viewType],
                globalState: { searchModel: JSON.stringify(this.env.searchModel.exportState()) },
            },
        });
    }

    /**
     * Handler executed when the user clicks on a statistic.
     * @param {string} statName
     */
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

DashboardView.components = {
    ControlPanel,
    SearchPanel,
    DashboardStatistic,
    ViewWidget,
    ViewWrapper,
    Banner: OnboardingBanner,
};

DashboardView.type = "dashboard";

DashboardView.display_name = "dashboard";
DashboardView.icon = "fa-tachometer";
DashboardView.multiRecord = true;

DashboardView.searchMenuTypes = ["filter", "comparison", "favorite"];

viewRegistry.add("dashboard", DashboardView);
