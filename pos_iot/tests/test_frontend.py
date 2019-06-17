# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import odoo.tests


@odoo.tests.tagged('post_install', '-at_install', 'pos_scale')
class TestUi(odoo.tests.HttpCase):

    def test_02_pos_iot_scale(self):
        env = self.env(user=self.env.ref('base.user_admin'))

        # Create IoT Box
        iotbox_id = env['iot.box'].sudo().create({
            'name': 'iotbox-test',
            'identifier': '01:01:01:01:01:01',
            'ip': '1.1.1.1',
        })

        # Create IoT device
        env['iot.device'].sudo().create({
            'iot_id': iotbox_id.id,
            'name': 'Scale',
            'identifier': 'test_scale',
            'type': 'scale',
            'connection': 'direct',
        })

        # Select IoT Box, tick electronic scale
        main_pos_config = env.ref('point_of_sale.pos_config_main')
        main_pos_config.write({
            'iotbox_id': iotbox_id.id,
            'iface_electronic_scale': True,
        })

        self.start_tour("/web", 'pos_iot_scale_tour', login="admin")
