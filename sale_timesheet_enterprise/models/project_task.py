# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import _, models

from odoo.addons.sale_timesheet_enterprise.models.sale import DEFAULT_INVOICED_TIMESHEET


class ProjectTask(models.Model):
    _inherit = 'project.task'

    def read(self, fields=None, load='_classic_read'):
        """ Override read method to filter timesheets in the task(s) is the user is portal user
            and the sale.invoiced_timesheet configuration is set to 'approved'
            Then we need to give the id of timesheets which is validated.
        """
        result = super().read(fields=fields, load=load)
        if fields and 'timesheet_ids' in fields and self.env.user.has_group('base.group_portal'):
            # We need to check if configuration
            param_invoiced_timesheet = self.env['ir.config_parameter'].sudo().get_param('sale.invoiced_timesheet', DEFAULT_INVOICED_TIMESHEET)
            if param_invoiced_timesheet == 'approved':
                timesheets_read_group = self.env['account.analytic.line'].read_group(
                    [('task_id', 'in', self.ids), ('validated', '=', True)],
                    ['ids:array_agg(id)', 'task_id'],
                    ['task_id'],
                )
                timesheets_dict = {res['task_id'][0]: res['ids'] for res in timesheets_read_group}
                for record_read in result:
                    record_read['timesheet_ids'] = timesheets_dict.get(record_read['id'], [])
        return result

    def _gantt_progress_bar_sale_line_id(self, res_ids):
        if not self.env['sale.order.line'].check_access_rights('read', raise_exception=False):
            return {}
        uom_hour = self.env.ref('uom.product_uom_hour')
        allocated_hours_per_sol = self.env['project.task'].read_group([
            ('sale_line_id', 'in', res_ids),
        ], ['sale_line_id', 'allocated_hours'], ['sale_line_id'])
        allocated_hours_per_sol_mapped = {
            sol['sale_line_id'][0]: sol['allocated_hours']
            for sol in allocated_hours_per_sol
        }
        return {
            sol.id: {
                'value': allocated_hours_per_sol_mapped.get(sol.id, 0.0),
                'max_value': sol.product_uom._compute_quantity(sol.product_uom_qty, uom_hour),
            }
            for sol in self.env['sale.order.line'].search([('id', 'in', res_ids)])
        }

    def _gantt_progress_bar(self, field, res_ids, start, stop):
        if field == 'sale_line_id':
            return dict(
                self._gantt_progress_bar_sale_line_id(res_ids),
                warning=_("This Sale Order Item doesn't have a target value of planned hours. Planned hours :")
            )
        return super()._gantt_progress_bar(field, res_ids, start, stop)
