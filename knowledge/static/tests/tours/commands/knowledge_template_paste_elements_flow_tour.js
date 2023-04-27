/** @odoo-module */

import { registry } from "@web/core/registry";
import { openCommandBar } from '../knowledge_tour_utils.js';
import { stepUtils } from "@web_tour/tour_service/tour_utils";

registry.category("web_tour.tours").add('knowledge_template_paste_elements_tour', {
    url: '/web',
    test: true,
    steps: [stepUtils.showAppsMenuItem(), {
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
    trigger: 'button[title="Search Knowledge Articles"]',
    run: 'click',
    width: 500
}, {
    trigger: '.modal-content .form-control',
    run: 'text Test'
}, {
    trigger: '.o_command_hotkey'
}, {
    trigger: '.odoo-editor-editable[contenteditable="true"] > :last-child',
    run: function () {
        openCommandBar(this.$anchor[0]);
    },
}, { // click on the /clipboard command
    trigger: '.oe-powerbox-commandName:contains("Clipboard")',
    run: 'click',
}, { // wait for the block to appear in the editor
    trigger: '.o_knowledge_behavior_type_template',
    width: 500
}, { // enter text into the mail template
    trigger: '.o_knowledge_content > p',
    run: 'text Hello world'
}, {
    trigger: '.btn-primary:contains(Use as)',
    run: 'click'
}, {
    trigger: '.note-editable > p:contains("Hello world")',
}]});
