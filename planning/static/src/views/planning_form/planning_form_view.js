/** @odoo-module **/

import { formView } from "@web/views/form/form_view";
import { FormController } from "@web/views/form/form_controller";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";

const { markup } = owl;

export class PlanningFormController extends FormController {

    setup() {
        super.setup();
        this.notification = useService("notification");
    }

    async save(params = {})  {
        const dirtyFields = this.model.root.dirtyFields.map((f) => f.name);
        super.save(params);

        if (dirtyFields.includes('repeat') && this.model.root.data['repeat']) {
            const message = this.env._t("The recurring shifts have successfully been created.");
            this.notification.add(
                markup(`<i class="fa fa-fw fa-check"></i><span class="ms-1">${message}</span>`),
                {type: "success"}
            );
        }
    }
}

export const planningFormView = {
    ...formView,
    Controller: PlanningFormController,
};

registry.category("views").add("planning_form", planningFormView);
