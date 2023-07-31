/** @odoo-module */
import { Component, onWillStart, useState } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { registry } from "@web/core/registry";
import { _t } from "@web/core/l10n/translation";
import { standardActionServiceProps } from "@web/webclient/actions/action_service";

class WebsiteFormManager extends Component {
    static template = "website_studio.FormManager";
    static props = { ...standardActionServiceProps };

    setup() {
        this.studio = useService("studio");
        this.rpc = useService("rpc");
        this.action = useService("action");
        this.user = useService("user");
        this.notification = useService("notification");
        this.state = useState({ forms: [] });
        this.isDesigner = false;

        onWillStart(() => {
            return Promise.all([
                this.getExistingForms(),
                this.user
                    .hasGroup("website.group_website_designer")
                    .then((r) => (this.isDesigner = r)),
            ]);
        });
    }

    get resModel() {
        return this.studio.editedAction.res_model;
    }

    async getExistingForms() {
        const forms = await this.rpc("/website_studio/get_forms", {
            res_model: this.resModel,
        });
        this.state.forms = forms;
    }

    async onNewForm() {
        if (this.isDesigner) {
            const url = await this.rpc("/website_studio/create_form", {
                res_model: this.resModel,
            });
            this.getExistingForms(); // don't wait
            return this.openFormUrl(url);
        } else {
            this.notification.add(
                _t(
                    "Sorry, only users with the following" +
                        " access level are currently allowed to do that:" +
                        " 'Website/Editor and Designer'"
                ),
                {
                    title: _t("Error"),
                    type: "danger",
                }
            );
        }
    }

    openFormUrl(url) {
        return this.action.doAction({ type: "ir.actions.act_url", url: `${url}?enable_editor=1` });
    }
}

registry.category("actions").add("website_studio.action_form_manager", WebsiteFormManager);
registry
    .category("web_studio.editor_tabs")
    .add("website", { name: _t("Website Forms"), action: "website_studio.action_form_manager" });
