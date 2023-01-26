/** @odoo-module **/

import { ActionContainer } from "@web/webclient/actions/action_container";
import { useService } from "@web/core/utils/hooks";
import { registry } from "@web/core/registry";
import { KeepLast } from "@web/core/utils/concurrency";
import { onWillStart, onWillUpdateProps } from "@odoo/owl";
import { useStudioServiceAsReactive } from "@web_studio/studio_service";

const editorTabRegistry = registry.category("web_studio.editor_tabs");

export class StudioActionContainer extends ActionContainer {
    setup() {
        super.setup();
        this.actionService = useService("action");
        this.studio = useStudioServiceAsReactive();
        this.rpc = useService("rpc");

        let actionKey = 1;
        const onUiUpdate = () => {
            actionKey++;
        };
        this.env.bus.addEventListener("ACTION_MANAGER:UPDATE", onUiUpdate);
        owl.onWillUnmount(() =>
            this.env.bus.removeEventListener("ACTION_MANAGER:UPDATE", onUiUpdate)
        );

        const doAction = async (action, options) => {
            try {
                await this.actionService.doAction(action, options);
                this.actionKey = actionKey;
            } catch (e) {
                if (action !== "web_studio.action_editor") {
                    // Fallback on the actionEditor, except if the actionEditor crashes
                    this.studio.setParams({ editorTab: "views" });
                }
                // Rethrow anyway: the error doesn't originates from a user's action
                throw e;
            }
        };

        onWillStart(async () => {
            const action = await this.getStudioAction();
            doAction(action);
            await Promise.resolve();
        });

        const willUpdateKeepLast = new KeepLast();
        onWillUpdateProps(async () => {
            if (this.studio.reset || this.actionKey !== actionKey) {
                const action = await willUpdateKeepLast.add(this.getStudioAction());
                doAction(action, { clearBreadcrumbs: true });
                await Promise.resolve();
            }
        });
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
            action.help = action.help && owl.markup(action.help);
            return action;
        }
    }
}
StudioActionContainer.props = {
    ...ActionContainer.props,
    reloadId: { type: Number },
};
