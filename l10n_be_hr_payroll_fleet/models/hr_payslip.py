# -*- coding:utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class HrPayslip(models.Model):
    _inherit = 'hr.payslip'

    vehicle_id = fields.Many2one('fleet.vehicle', string='Company Car', domain="['|', ('company_id', '=', False), ('company_id', '=', company_id)]", help="Employee's company car.")

    @api.onchange('employee_id', 'struct_id', 'contract_id', 'date_from', 'date_to')
    def _onchange_employee(self):
        res = super(HrPayslip, self)._onchange_employee()
        contract_sudo = self.contract_id.sudo()
        if contract_sudo.car_id:
            if contract_sudo.car_id.future_driver_id:
                tmp_vehicle = self.env['fleet.vehicle'].search(
                    [('driver_id', '=', contract_sudo.car_id.future_driver_id.id)], limit=1)
                self.vehicle_id = tmp_vehicle
            else:
                self.vehicle_id = contract_sudo.car_id
        return res

    def _get_data_files_to_update(self):
        # Note: file order should be maintained
        return super()._get_data_files_to_update() + [(
            'l10n_be_hr_payroll_fleet', [
                'data/hr_rule_parameter_data.xml',
                'data/cp200_employee_salary_data.xml',
            ])]
