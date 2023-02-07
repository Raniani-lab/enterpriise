/** @odoo-module **/
import { Component, EventBus, onWillDestroy, useSubEnv, reactive } from "@odoo/owl";

import { registry } from "@web/core/registry";
import { useBus, useService } from "@web/core/utils/hooks";

import { StudioActionContainer } from "../studio_action_container";
import { actionService } from "@web/webclient/actions/action_service";
import { EditorMenu } from "./editor_menu/editor_menu";
import { mapDoActionOptionAPI } from "@web/legacy/backend_utils";
import { ConfirmationDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import { AppMenuEditor } from "./app_menu_editor/app_menu_editor";
import { NewModelItem } from "./new_model_item/new_model_item";

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

const menuButtonsRegistry = registry.category("studio_navbar_menubuttons");
export class Editor extends Component {
    static menuButtonsId = 1;
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

        this.state = owl.useState({ actionContainerId: 1 });
        useBus(this.studio.bus, "UPDATE", async () => {
            this.state.actionContainerId++;
        });

        // Push instance-specific components in the navbar. Because we want those elements
        // immediately, we add them at setup time, not onMounted.
        // Also, because they are Editor instance-specific, and that Destroyed is mostly called
        // after the new instance is created, we need to remove the old entries before adding the new ones
        menuButtonsRegistry.getEntries().forEach(([name]) => {
            if (name.startsWith("app_menu_editor_") || name.startsWith("new_model_item_")) {
                menuButtonsRegistry.remove(name);
            }
        });
        const menuButtonsId = this.constructor.menuButtonsId++;
        menuButtonsRegistry.add(`app_menu_editor_${menuButtonsId}`, {
            Component: AppMenuEditor,
            props: { env: this.env },
        });
        menuButtonsRegistry.add(`new_model_item_${menuButtonsId}`, { Component: NewModelItem });
        onWillDestroy(() => {
            menuButtonsRegistry.remove(`app_menu_editor_${menuButtonsId}`);
            menuButtonsRegistry.remove(`new_model_item_${menuButtonsId}`);
        });
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
