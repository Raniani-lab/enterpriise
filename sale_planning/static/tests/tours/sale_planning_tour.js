/** @odoo-module */

import { registry } from "@web/core/registry";

const planningTestTour = registry.category("web_tour.tours").get("planning_test_tour");
const salePlanningStartStepIndex = planningTestTour.steps.findIndex((step) => step.id && step.id === 'planning_check_format_step');

planningTestTour.steps.splice(salePlanningStartStepIndex + 1, 0, {
        trigger: ".o_gantt_button_plan_so",
        content: "Click on Plan Orders button to assign sale order to employee",
        run: 'click',
    }, {
        trigger: ".o_gantt_cell.o_gantt_hoverable",
        content: "Click on magnify icon to see list of sale order",
        run: function () {
            this.$anchor[0].dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
        },
    },
    {
        trigger: ".o_gantt_cells .o_gantt_cell_plan",
        run: 'click',
    },
    {
        trigger: "tr.o_data_row td[data-tooltip='Developer']",
        content: "Select the slot and plan orders",
        run: 'click',
    }, {
        trigger: ".o_gantt_pill span:contains(Developer)",
        content: "Check the naming format when SO is selected from magnify icon",
        run: function () {}
    }
);
