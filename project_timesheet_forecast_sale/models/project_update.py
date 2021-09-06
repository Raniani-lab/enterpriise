# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models

class ProjectUpdate(models.Model):
    _inherit = 'project.update'

    @api.model
    def _get_services_values(self, project):
        services = super()._get_services_values(project)
        if not project.allow_billable or not project.allow_forecast:
            return services
        services['total_planned'] = 0
        sol_ids = [
            service['sol'].id
            for service in services['data']
        ]
        slots = self.env['planning.slot'].read_group([
            ('order_line_id', 'in', sol_ids),
            ('start_datetime', '>=', fields.Date.today())
        ], ['order_line_id', 'allocated_hours'], ['order_line_id'])
        slots_by_order_line = {res['order_line_id'][0]: res['allocated_hours'] for res in slots}
        total_planned = 0
        for service in services['data']:
            allocated_hours = slots_by_order_line.get(service['sol'].id, 0)
            service['planned_value'] = float(allocated_hours)
            total_planned += allocated_hours
        uom_hour = self.env.ref('uom.product_uom_hour')
        services['total_planned'] = float(uom_hour._compute_quantity(total_planned, self.env.company.timesheet_encode_uom_id, raise_if_failure=False))
        return services
