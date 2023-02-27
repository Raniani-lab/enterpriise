/** @odoo-module */
/* global posmodel */

import { registry } from "@web/core/registry";
import DeviceProxy from "iot.DeviceProxy";
import { stepUtils } from "@web_tour/tour_service/tour_utils";

var PosScaleDummy = DeviceProxy.extend({
    action: function () { },
    remove_listener: function () { },
    add_listener: function (callback) {
        setTimeout(() => callback({
            status: 'ok',
            value: 2.35
        }), 1000);
        return Promise.resolve();
    }
});

registry.category("web_tour.tours").add('pos_iot_scale_tour', {
    url: '/web',
    test: true,
    steps: [stepUtils.showAppsMenuItem(),
    {
        trigger: '.o_app[data-menu-xmlid="point_of_sale.menu_point_root"]',
    }, {
        trigger: ".o_pos_kanban button.oe_kanban_action_button",
    }, {
        trigger: '.pos .pos-content',
        run: function () {
            posmodel.env.proxy.iot_device_proxies.scale = new PosScaleDummy(null, { iot_ip: '', identifier: '' });
        }
    }, { // Leave category displayed by default
        trigger: ".breadcrumb-home",
    }, {
        trigger: '.product:contains("Whiteboard Pen")',
    }, {
        trigger: '.js-weight:contains("2.35")',
    }, {
        trigger: '.buy-product',
    }, {
        trigger: ".header-button",
    }, {
        trigger: ".header-button",
        run: function () { }, //it's a check,
    }]});
