/** @odoo-module */

import tour from 'web_tour.tour';
import { openCommandBar } from '../knowledge_tour_utils.js';

tour.register('knowledge_template_paste_elements_tour', {
    url: '/web',
    test: true,
}, [tour.stepUtils.showAppsMenuItem(), {
    trigger: '.o_app[data-menu-xmlid="crm.crm_menu_root"]',
}, {
    trigger: '.o-kanban-button-new',
}, {
    trigger: '.o_required_modifier .o_input',
    run: 'text Test'
}, {
    trigger: '.o_kanban_edit',
    run: 'click'
}, {
    trigger: '.o_ChatterTopbar_button[title="Search Knowledge Articles"]',
    run: 'click',
    width: 500
}, {
    trigger: '.modal-content .form-control',
    run: 'text Test'
}, {
    trigger: '.o_command_hotkey'
}, {
    trigger: '.odoo-editor-editable > :last-child',
    run: function () {
        openCommandBar(this.$anchor[0]);
    },
}, { // click on the /template command
    trigger: '.oe-powerbox-commandName:contains("Template")',
    run: 'click',
}, { // wait for the block to appear in the editor
    trigger: '.o_knowledge_behavior_type_template',
    width: 500
}, { // enter text into the mail template
    trigger: '.o_knowledge_content > p',
    run: 'text Hello world'
}, {
    trigger: '.btn-primary[title="Use as Description"]',
    run: 'click'
}, {
    trigger: '.note-editable > p:contains("Hello world")',
}]);
