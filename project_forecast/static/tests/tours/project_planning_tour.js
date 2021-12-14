/** @odoo-module **/

import tour from 'web_tour.tour';

const planningTestTour = tour.tours.planning_test_tour
const projectPlanningStartStepIndex = planningTestTour.steps.findIndex((step) => step.id && step.id === 'project_planning_start');

planningTestTour.steps.splice(projectPlanningStartStepIndex + 1, 0, {
    trigger: ".o_field_many2one[name='project_id'] input",
    content: "Create project named-'New Project' for this shift",
    run: "text New Project",
}, {
    trigger: "ul.ui-autocomplete a:contains(New Project)",
    auto: true,
    in_modal: false,
}, {
    trigger: ".o_field_many2one[name='task_id'] input",
    content: "Create task named-'New Task' for this shift",
    run: "text New Task",
}, {
    trigger: "ul.ui-autocomplete a:contains(New Task)",
    auto: true,
    in_modal: false,
});

const projectPlanningEndStepIndex = planningTestTour.steps.findIndex((step) => step.id && step.id === 'planning_check_format_step');

planningTestTour.steps.splice(projectPlanningEndStepIndex + 1, 0, {
    trigger: ".o_gantt_button_add",
    content: "Click Add record to verify the naming format of planning template",
},
{
    trigger: "span.o_selection_badge:contains('[New Project - New Task]')",
    content: "Check the naming format of planning template",
    run: function () {}
});
