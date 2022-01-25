/** @odoo-module **/

import tour from 'web_tour.tour';
import helper from 'mrp_workorder.tourHelper';

tour.register('test_add_component', {test: true}, [
    {
        trigger: '.o_tablet_client_action',
        run: function () {
            helper.assertCheckLength(2);
            helper.assertValidatedCheckLength(0);
            helper.assertQtyToProduce(1, 1);
            helper.assertCurrentCheck('Register Consumed Materials "Elon Musk"');
            helper.assertComponent('Elon Musk', 'readonly', 1, 1);
        }
    },
    {trigger: '.btn[name="button_start"]'},
    {
        trigger: '.o_workorder_icon_btn',
        extra_trigger: '.btn[name="button_pending"]',
    },
    {trigger: '.o_tablet_popups'},
    {trigger: '.btn:contains("Add Component")'},
    {trigger: '.modal-title:contains("Add Component")'},
    {
        trigger: "div.o_field_widget[name='product_id'] input ",
        position: 'bottom',
        run: 'text extra',
    }, {
        trigger: '.ui-menu-item > a:contains("extra")',
        in_modal: false,
        auto: true,
    }, {
        trigger: "div.o_field_widget[name='product_qty'] input",
        in_modal: true,
        position: 'bottom',
        run: 'text 3',
    },
    {trigger: '.btn-primary[name="add_product"]'},
    {
        trigger: '.o_tablet_client_action',
        run: function () {
            helper.assertCheckLength(3);
            helper.assertValidatedCheckLength(0);
            helper.assertQtyToProduce(1, 1);
            helper.assertCurrentCheck('Register Consumed Materials "extra"');
            helper.assertComponent('extra', 'editable', 3, 3);
        }
    }, {
        trigger: "div.o_field_widget[name='lot_id'] input ",
        position: 'bottom',
        run: 'text lot1',
    }, {
        trigger: '.ui-menu-item > a:contains("lot1")',
        in_modal: false,
        auto: true,
    },
    // go to Elon Musk step (second one since 'extra')
    {trigger: '.o_tablet_step:nth-child(2)'},
    {trigger: 'span[name="qty_done"]'},
    {
        trigger: '.o_tablet_client_action',
        run: function () {
            helper.assertCheckLength(3);
            helper.assertValidatedCheckLength(0);
            helper.assertQtyToProduce(1, 1);
            helper.assertCurrentCheck('Register Consumed Materials "Elon Musk"');
            helper.assertComponent('Elon Musk', 'readonly', 1, 1);
        }
    },
    // go to metal cylinder step
    {trigger: '.btn[name="action_next"]'},
    {trigger: 'span[name="component_id"]:contains("Metal")'},
    {
        trigger: '.o_tablet_client_action',
        run: function () {
            helper.assertComponent('Metal cylinder', 'editable', 2, 2);
            helper.assertCheckLength(3);
            helper.assertValidatedCheckLength(1);
            helper.assertQtyToProduce(1, 1);
            helper.assertCurrentCheck('Register Consumed Materials "Metal cylinder"');
        }
    }, {
        trigger: 'input[name="qty_done"]',
        position: 'bottom',
        run: 'text 1',
    }, {
        trigger: 'div.o_field_widget[name="lot_id"] input',
        position: 'bottom',
        run: 'text mc1',
    },
    {trigger: '.btn[name=action_next]'},
    {trigger: '.o_workorder_icon_btn'},
    {trigger: '.o_tablet_popups'},
    {trigger: '.btn:contains("Add By-product")'},
    {trigger: '.modal-title:contains("Add By-Product")'},
    {
        trigger: "div.o_field_widget[name='product_id'] input ",
        position: 'bottom',
        run: 'text extra-bp',
    }, {
        trigger: '.ui-menu-item > a:contains("extra-bp")',
        in_modal: false,
        auto: true,
    }, {
        trigger: "div.o_field_widget[name='product_qty'] input",
        in_modal: true,
        position: 'bottom',
        run: 'text 1',
    },
    {trigger: '.btn-primary[name="add_product"]'},
    {
        trigger: '.o_tablet_client_action',
        run: function () {
            helper.assertCheckLength(4);
            helper.assertValidatedCheckLength(2);
            helper.assertQtyToProduce(1, 1);
            helper.assertCurrentCheck('Register By-products "extra-bp"');
            helper.assertComponent('extra-bp', 'editable', 1, 1);
        }
    }, {
        trigger: "div.o_field_widget[name='lot_id'] input ",
        position: 'bottom',
        run: 'text lot2',
    }, {
        trigger: '.ui-menu-item > a:contains("lot2")',
        in_modal: false,
        auto: true,
    },
]);
