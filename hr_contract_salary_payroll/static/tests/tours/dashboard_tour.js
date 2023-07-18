/** @odoo-module **/

import { registry } from "@web/core/registry";
import '@hr_payroll/../tests/tours/dashboard_tour';
import { patch } from "@web/core/utils/patch";

patch(registry.category("web_tour.tours").get("payroll_dashboard_ui_tour"), "patch_payroll_dashboard_ui_tour", {
    steps() {
        const originalSteps = this._super();
        const stepIndex = originalSteps.findIndex((step) => step.id === "set_hr_responsible");
        originalSteps.splice(stepIndex + 1, 0, {
            /**
             * Add some steps upon creating the contract as new fields are added and are required
             * with the hr_contract_salary module.
             */
            content: "Set Contract Template",
            trigger: 'div.o_field_widget.o_field_many2one[name="sign_template_id"] div input',
            run: 'text Employment',
        }, {
            content: "Select Contract Template",
            trigger: '.ui-menu-item a:contains("Employment")',
        });
        return originalSteps; 
    }
});
