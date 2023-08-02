/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { PlanningControllerActions } from "@planning/views/planning_hooks";


patch(PlanningControllerActions.prototype, {
    autoPlanSuccessNotification() {
        return this.env._t("The open shifts and sales orders have been successfully assigned.");
    },

    autoPlanFailureNotification() {
        return this.env._t(
            "All open shifts and sales orders have already been assigned, or there are no resources available to take them at this time."
        );
    }
});
