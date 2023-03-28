/** @odoo-module **/

import { registry } from "@web/core/registry";
import helper from 'mrp_workorder.tourHelper';

registry.category("web_tour.tours").add('test_production_with_employee', {test: true, steps: () => [
    { trigger: 'div.popup' },
    { trigger: 'h3:contains("Change Worker")' },
    { trigger: 'div.selection-item:contains("Arthur")' },
    { trigger: 'div.popup-numpad' },
    { trigger: '.popup-numpad button:contains("1")' },
    { trigger: 'span.highlight:contains("•")' },
    { trigger: '.popup-numpad button:contains("2")' },
    { trigger: 'span.highlight:contains("••")' },
    { trigger: '.popup-numpad button:contains("3")' },
    { trigger: 'span.highlight:contains("•••")' },
    { trigger: '.popup-numpad button:contains("4")' },
    { trigger: 'span.highlight:contains("••••")' },
    { trigger: 'button.confirm' },
    {
        trigger: 'span[title="Arthur Fu"]',
        run: function () {
            helper.assertCheckLength(3);
            helper.assertValidatedCheckLength(0);
            helper.assertQtyToProduce(2, 2);
            helper.assertCurrentCheck('Instruction 1');
        }
    },
    { trigger: 'div[name=employee_name]' },
    { trigger: 'button.btn-link:contains("New")' },
    { trigger: 'h3:contains("Change Worker")' },
    { trigger: 'div.selection-item:contains("Thomas")' },
    { trigger: 'div.popup-numpad' },
    { trigger: '.popup-numpad button:contains("5")' },
    { trigger: 'span.highlight:contains("•")' },
    { trigger: '.popup-numpad button:contains("6")' },
    { trigger: 'span.highlight:contains("••")' },
    { trigger: '.popup-numpad button:contains("7")' },
    { trigger: 'span.highlight:contains("•••")' },
    { trigger: '.popup-numpad button:contains("8")' },
    { trigger: 'span.highlight:contains("••••")' },
    { trigger: 'button.confirm' },
    {
        trigger: 'span[title="Thomas Nific"]',
        run: function () {
            helper.assertCheckLength(3);
            helper.assertValidatedCheckLength(0);
            helper.assertQtyToProduce(2, 2);
            helper.assertCurrentCheck('Instruction 1');
        }
    },
    { trigger: 'div[name=employee_name]' },
    { trigger: 'button.btn_employee:contains("Thomas")' },
    { trigger: 'button[name="action_next"]' },
    { trigger: 'div[name=qty_producing]:contains("2")'}, //field become readon ly
    {
        trigger: '.o_tablet_step_ok',
        run: function () {
            helper.assertCheckLength(3);
            helper.assertValidatedCheckLength(1);
            helper.assertQtyToProduce(2, 2);
            helper.assertCurrentCheck('Instruction 2');
        }
    },
    {trigger: 'button[name="action_next"]'},
    {
        trigger: 'p:contains("third")',
        run: function () {
            helper.assertCheckLength(3);
            helper.assertValidatedCheckLength(2);
            helper.assertQtyToProduce(2, 2);
            helper.assertCurrentCheck('Instruction 3');
        }
    },
    { trigger: 'button[name=openMenuPopup]' },
    { trigger: '.o_tablet_popups' },
    { trigger: '.btn:contains("Update Instruction")' },
    { trigger: '.modal-title:contains("Update Instruction")' },
    // {
    //     trigger: "div[name=note] p",
    //     position: 'bottom',
    //     run: 'text my new instruction',
    // }, {
    {
        trigger: "input#comment_0",
        position: 'bottom',
        run: 'text my reason',
    },
    { trigger: '.btn-primary[name="process"]' },
    { trigger: '.o_tablet_client_action' },
    { trigger: '.btn-primary[name="action_next"]' },
    { trigger: '.btn[name=do_finish]' },
    { trigger: '.o_searchview_input' },
]});
registry.category("web_tour.tours").add('test_serial_tracked_and_register', {test: true, steps: () => [
    {
        trigger: '.o_tablet_client_action',
        run: function() {
            helper.assert($('input[id="finished_lot_id_0"]').val(), 'Magic Potion_1');
        }
    },
    { trigger: '.o_tablet_client_action' },
    {
        // sn should have been updated to match move_line sn
        trigger: 'div.o_field_widget[name="lot_id"] input ',
        run: function() {
            helper.assert($('input[id="lot_id_0"]').val(), 'Magic_2');
        }
    },
    { trigger: '.o_tablet_client_action' },
    { trigger: '.btn[name="button_start"]' },
    {
        trigger: 'div.o_field_widget[name="lot_id"] input ',
        position: 'bottom',
        run: 'text Magic_3',
    },
    { trigger: '.ui-menu-item > a:contains("Magic_3")' },
    { trigger: '.o_tablet_client_action' },
    {
        trigger: 'div.o_field_widget[name="finished_lot_id"] input ',
        position: 'bottom',
        run: 'text Magic Potion_2',
    },
    { trigger: '.ui-menu-item > a:contains("Magic Potion_2")' },
    {
        // comp sn shouldn't change when produced sn is changed
        trigger: 'div.o_field_widget[name="lot_id"] input',
        run: function() {
            helper.assert($('input[id="lot_id_0"]').val(), 'Magic_3');
        }
    },
    { trigger: '.o_tablet_client_action' },
    {
        trigger: 'div.o_field_widget[name="lot_id"] input ',
        position: 'bottom',
        run: 'text Magic_1',
    },
    { trigger: '.ui-menu-item > a:contains("Magic_1")' },
    { trigger: '.o_tablet_client_action' },
    {
        // produced sn shouldn't change when comp sn is changed
        trigger: 'div.o_field_widget[name="finished_lot_id"] input ',
        run: function() {
            helper.assert($('input[id="finished_lot_id_0"]').val(), 'Magic Potion_2');
        }
    },
    { trigger: '.o_tablet_client_action' },
    { trigger: '.btn-primary[name="action_next"]' },
    { trigger: 'button[name=do_finish]' },
    { trigger: '.o_searchview_input' },
]});
