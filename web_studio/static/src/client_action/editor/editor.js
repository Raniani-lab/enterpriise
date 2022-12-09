/** @odoo-module **/

import { StudioActionContainer } from "../studio_action_container";
import { actionService } from "@web/webclient/actions/action_service";
import { useBus, useService } from "@web/core/utils/hooks";
import { registry } from "@web/core/registry";

import { EditorMenu } from "./editor_menu/editor_menu";

import { mapDoActionOptionAPI } from "@web/legacy/backend_utils";

import { Component, EventBus, markup, onWillStart, useSubEnv, reactive } from "@odoo/owl";
import { ConfirmationDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import { KeepLast } from "@web/core/utils/concurrency";

const editorTabRegistry = registry.category("web_studio.editor_tabs");

const actionServiceStudio = {
    dependencies: ["studio"],
    start(env, { studio }) {
        const action = actionService.start(env);
        const _doAction = action.doAction;

        async function doAction(actionRequest, options) {
            if (actionRequest === "web_studio.action_edit_report") {
                return studio.setParams({
                    editedReport: options.report,
                });
            }
            return _doAction(...arguments);
        }

        return Object.assign(action, { doAction });
    },
};

class EditionFlow {
    constructor(env, services) {
        this.env = env;
        for (const [servName, serv] of Object.entries(services)) {
            this[servName] = serv;
        }
    }
    loadViews() {
        const { context, views, res_model, id } = this.studio.editedAction;
        const newContext = { ...context, studio: true, lang: false };
        const options = { loadIrFilters: true, loadActionMenus: false, id };
        return this.view.loadViews({ resModel: res_model, views, context: newContext }, options);
    }
    restoreDefaultView(viewId, viewType) {
        return new Promise((resolve) => {
            const confirm = async () => {
                if (!viewId && viewType) {
                    // To restore the default view from an inherited one, we need first to retrieve the default view id
                    const result = await this.loadViews();
                    viewId = result.views[viewType].id;
                }
                const res = await this.rpc("/web_studio/restore_default_view", {
                    view_id: viewId,
                });
                this.env.bus.trigger("CLEAR-CACHES");
                resolve(res);
            };
            this.dialog.add(ConfirmationDialog, {
                body: this.env._t(
                    "Are you sure you want to restore the default view?\r\nAll customization done with studio on this view will be lost."
                ),
                confirm,
                cancel: () => resolve(false),
            });
        });
    }
}

export class Editor extends Component {
    setup() {
        const services = Object.create(this.env.services);

        const globalBus = this.env.bus;
        const newBus = new EventBus();
        newBus.on("CLEAR-CACHES", this, () => globalBus.trigger("CLEAR-CACHES"));

        useSubEnv({
            bus: newBus,
            services,
        });

        // Assuming synchronousness for all services instanciation
        services.router = {
            current: { hash: {} },
            pushState() {},
        };
        this.studio = useService("studio");

        services.action = actionServiceStudio.start(this.env, { studio: this.studio });

        const editionFlow = new EditionFlow(this.env, {
            rpc: useService("rpc"),
            dialog: useService("dialog"),
            studio: this.studio,
            view: useService("view"),
        });
        useSubEnv({
            editionFlow: reactive(editionFlow),
        });

        this.actionService = useService("action");
        this.rpc = useService("rpc");

        const keepLastStudio = new KeepLast();
        useBus(this.studio.bus, "UPDATE", async () => {
            const action = await keepLastStudio.add(this.getStudioAction());
            this.actionService.doAction(action, {
                clearBreadcrumbs: true,
            });
        });

        onWillStart(this.onWillStart);
    }

    async onWillStart() {
        this.initialAction = await this.getStudioAction();
    }

    switchView({ viewType }) {
        this.studio.setParams({ viewType, editorTab: "views" });
    }
    switchViewLegacy(ev) {
        this.studio.setParams({ viewType: ev.detail.view_type });
    }

    switchTab({ tab }) {
        this.studio.setParams({ editorTab: tab });
    }

    async getStudioAction() {
        const { editorTab, editedAction, editedReport, editedViewType } = this.studio;
        const tab = editorTabRegistry.get(editorTab);
        if (editorTab === "views") {
            if (editedViewType) {
                return "web_studio.view_editor";
            }
            return tab.action;
        }
        if (tab.action) {
            return tab.action;
        } else if (editorTab === "reports" && editedReport) {
            return "web_studio.report_editor";
        } else {
            const action = await this.rpc("/web_studio/get_studio_action", {
                action_name: editorTab,
                model: editedAction.res_model,
                view_id: editedAction.view_id && editedAction.view_id[0], // Not sure it is correct or desirable
            });
            action.help = action.help && markup(action.help);
            return action;
        }
    }

    onDoAction(ev) {
        // @legacy;
        const payload = ev.detail;
        const legacyOptions = mapDoActionOptionAPI(payload.options);
        this.actionService.doAction(
            payload.action,
            Object.assign(legacyOptions || {}, { clearBreadcrumbs: true })
        );
    }
}
Editor.template = "web_studio.Editor";
Editor.props = {};
Editor.components = {
    EditorMenu,
    StudioActionContainer,
};
