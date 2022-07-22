odoo.define('industry_fsm.tour', function (require) {
"use strict";

var core = require('web.core');
const {Markup} = require('web.utils');
var tour = require('web_tour.tour');

var _t = core._t;

tour.register('industry_fsm_tour', {
    sequence: 90,
    url: "/web",
}, [{
    trigger: '.o_app[data-menu-xmlid="industry_fsm.fsm_menu_root"]',
    content: Markup(_t('Ready to <b>manage your onsite interventions</b>? <i>Click Field Service to start.</i>')),
    position: 'bottom',
}, {
    trigger: '.o-kanban-button-new',
    extra_trigger: '.o_fsm_kanban',
    content: _t('Let\'s create your first <b>task</b>.'),
    position: 'bottom',
}, {
    trigger: 'input.o_task_name',
    extra_trigger: '.o_form_editable',
    content: Markup(_t('Give it a <b>title</b> <i>(e.g. Boiler maintenance, Air-conditioning installation, etc.).</i>')),
    position: 'right',
    width: 200,
}, {
    trigger: ".o_legacy_form_view .o_task_customer_field",
    extra_trigger: '.o_form_project_tasks.o_form_editable',
    content: _t('Select the <b>customer</b> for your task.'),
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
    content: _t('Launch the timer to <b>track the time spent</b> on your task.'),
    position: "bottom",
    id: 'fsm_start',
}, {
    trigger: 'button[name="action_fsm_worksheet"]',
    extra_trigger: 'button[name="action_timer_stop"]',
    content: _t('Open your <b>worksheet</b> in order to fill it in with the details of your intervention.'),
    position: 'bottom',
}, {
    trigger: '.oe_form_field[name="comment"] .note-editable.odoo-editor-editable p',
    content: _t('Fill in your <b>worksheet</b> with the details of your intervention.'),
    run: function (actions) {
        this.$anchor.get(0).innerText = "My intervention details";
    },
    position: 'bottom',
    id: 'fill_work_template',
}, {
    trigger: ".o_form_button_save",
    content: Markup(_t('Save your <b>worksheet</b> once it is complete.<br/><i>Tip: customize this form to your needs and create as many templates as you want.</i>')),
    position: 'bottom'
}, {
    trigger: ".breadcrumb-item.o_back_button:nth-of-type(2)",
    content: Markup(_t("Use the breadcrumbs to return to your <b>task</b>.")),
    position: 'bottom'
}, {
    trigger: 'button[name="action_timer_stop"]',
    content: _t('Stop the <b>timer</b> when you are done.'),
    position: 'bottom',
}, {
    trigger: 'button[name="save_timesheet"]',
    content: Markup(_t('Confirm the <b>time spent</b> on your task. <i>Tip: note that the duration has automatically been rounded to 15 minutes.</i>')),
    position: 'bottom',
}, {
    trigger: 'button[name="action_preview_worksheet"]',
    extra_trigger: '.o_form_project_tasks',
    content: _t('<b>Review and sign</b> the <b>task report</b> with your customer.'),
    position: 'bottom',
}, {
    trigger: 'a[data-bs-target="#modalaccept"]',
    extra_trigger: '.o_project_portal_sidebar',
    content: _t('Invite your customer to <b>validate and sign your task report</b>.'),
    position: 'right',
}, {
    trigger: '.o_web_sign_auto_button',
    extra_trigger: '.o_project_portal_sidebar',
    content: _t('Save time by automatically generating a <b>signature</b>.'),
    position: 'right',
}, {
    trigger: '.o_portal_sign_submit:enabled',
    extra_trigger: '.o_project_portal_sidebar',
    content: _t('Validate the <b>signature</b>.'),
    position: 'left',
}, {
    trigger: 'a:contains(Back to edit mode)',
    extra_trigger: '.o_project_portal_sidebar',
    content: _t('Go back to your Field Service <b>task</b>.'),
    position: 'right',
}, {
    trigger: 'button[name="action_send_report"]',
    extra_trigger: '.o_form_project_tasks ',
    content: _t('<b>Send your task report</b> to your customer.'),
    position: 'bottom',
}, {
    trigger: 'button[name="action_send_mail"]',
    extra_trigger: '.o_form_project_tasks ',
    content: _t('<b>Send your task report</b> to your customer.'),
    position: 'right',
}, {
    trigger: "button[name='action_fsm_validate']",
    extra_trigger: '.o_form_project_tasks',
    content: _t('Let\'s <b>mark your task as done!</b> <i>Tip: when doing so, your stock will automatically be updated, and your task will be closed.</i>'),
    position: 'bottom',
    id: 'fsm_invoice_create',
}]);

});
