/** @odoo-module **/

import { registry } from "@web/core/registry";
import helper from '@mrp_workorder/../tests/tours/tour_helper_mrp_workorder';


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
