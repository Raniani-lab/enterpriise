/** @odoo-module **/

/**
 * Adapt the step that is specific to the work details when the `worksheet` module is not installed.
 */

import { registry } from "@web/core/registry";
import { patch } from "@web/core/utils/patch";
import 'industry_fsm.tour';

patch(registry.category("web_tour.tours").get("industry_fsm_tour"), "patch_industry_fsm_report_tour", {
    steps() {
        const originalSteps = this._super();
        const stepIndex = originalSteps.findIndex((step) => step.id === "sign_report");
        originalSteps.splice(stepIndex, 0, {
            trigger: 'div[name="worksheet_map"] h5#task_worksheet',
            extra_trigger: '.o_project_portal_sidebar',
            content: ('"Worksheet" section is rendered'),
            auto: true,
        }, {
            trigger: 'div[name="worksheet_map"] div[class*="row"] div:not(:empty)',
            extra_trigger: '.o_project_portal_sidebar',
            content: ('At least a field is rendered'),
            auto: true,
        });
        return originalSteps; 
    }
});
