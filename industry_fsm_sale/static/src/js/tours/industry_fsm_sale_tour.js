odoo.define('industry_fsm.tour', function (require) {
"use strict";

var core = require('web.core');
var tour = require('web_tour.tour');

var _t = core._t;

tour.register('industry_fsm_tour', {
    sequence: 10,
    url: "/web",
}, [{
    trigger: '.o_app[data-menu-xmlid="industry_fsm.fsm_menu_root"]',
    content: _t('Here is the <b>Field Service app</b>. Click on the icon to start managing your onsite interventions.'),
    position: 'bottom',
}, {
    trigger: '.o-kanban-button-new',
    extra_trigger: '.o_fsm_kanban',
    content: _t('Here is the view of the users who are on the field. Click CREATE to start your first task.'),
    position: 'bottom',
}, {
    trigger: 'input.o_task_name',
    extra_trigger: '.o_form_editable',
    content: _t('Add a task title. <br/><i>(e.g. Boiler replacement)</i>'),
    position: 'right',
    width: 200,
}, {
    trigger: ".o_form_view .o_task_customer_field",
    extra_trigger: '.o_form_project_tasks.o_form_editable',
    content: _t('Select or create a customer.'),
    position: "bottom",
    run: function (actions) {
        actions.text("Brandon Freeman", this.$anchor.find("input"));
    },
}, {
    trigger: ".ui-autocomplete > li > a",
    auto: true,
}, {
    trigger: 'button[name="action_timer_start"]',
    extra_trigger: '.o_form_project_tasks',
    content: _t('Start recording your time.'),
    position: "bottom",
    id: 'fsm_start',
}, {
    trigger: 'button[name="action_fsm_view_material"]',
    extra_trigger: '.o_form_project_tasks button[name="action_timer_stop"]', // needed to avoid concurrent access error
    content: _t('Record the material you used for the intervention.'),
    position: 'bottom',
}, {
    trigger: ".oe_kanban_action",
    extra_trigger: '.o_fsm_material_kanban',
    content: _t('Add a product by clicking on it.'),
    position: 'right',
}, {
    trigger: ".breadcrumb-item:not(.active):last",
    extra_trigger: '.o_fsm_material_kanban',
    content: _t("Use the breadcrumbs to <b>go back to your task</b>."),
    position: "right"
}, {
    trigger: 'button[name="action_timer_stop"]',
    content: _t('Stop the timer and save your timesheet.'),
    position: 'bottom',
}, {
    trigger: 'button[name="save_timesheet"]',
    content: _t('<b>Click the save button</b> to save the time spent.'),
    position: 'bottom',
    id: 'fsm_save_timesheet',
}, {
    trigger: "button[name='action_fsm_validate']",
    extra_trigger: '.o_form_project_tasks',
    content: _t('If everything looks good to you, mark the task as done. When doing so, your stock will automatically be updated and your task will move to te next stage.'),
    position: 'bottom',
}]);

});
