# -*- coding:utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import _, api, fields, models
from odoo.exceptions import AccessError

class HrPayslip(models.Model):
    _inherit = 'hr.payslip'

    vehicle_id = fields.Many2one(
        'fleet.vehicle', string='Company Car',
        compute='_compute_vehicle_id', store=True, readonly=False,
        domain="['|', ('company_id', '=', False), ('company_id', '=', company_id)]",
        states={'done': [('readonly', True)], 'cancel': [('readonly', True)]},
        help="Employee's company car.")

    @api.depends('contract_id.car_id.future_driver_id')
    def _compute_vehicle_id(self):
        termination_struct = self.env.ref('l10n_be_hr_payroll.cp200_employees_termination_fees_company_car_annual')
        for slip in self.filtered(lambda s: s.state not in ['done', 'cancel']):
            contract_sudo = slip.contract_id.sudo()
            if contract_sudo.car_id:
                if slip.struct_id != termination_struct and contract_sudo.car_id.future_driver_id:
                    tmp_vehicle = self.env['fleet.vehicle'].search(
                        [('driver_id', '=', contract_sudo.car_id.future_driver_id.id)], limit=1)
                    slip.vehicle_id = tmp_vehicle
                else:
                    slip.vehicle_id = contract_sudo.car_id

    def _get_data_files_to_update(self):
        # Note: file order should be maintained
        return super()._get_data_files_to_update() + [(
            'l10n_be_hr_payroll_fleet', [
                'data/hr_rule_parameter_data.xml',
                'data/cp200_employee_salary_data.xml',
            ])]

    @api.model
    def _get_dashboard_warnings(self):
        res = super()._get_dashboard_warnings()

        try:
            self.env['fleet.vehicle'].check_access_rights('read')
            self.env['fleet.vehicle.log.contract'].check_access_rights('read')
        except AccessError:
            return res

        self.env.cr.execute("""
            SELECT v.id
              FROM fleet_vehicle v
             WHERE v.driver_employee_id IS NOT NULL
               AND NOT EXISTS (SELECT 1
                                 FROM fleet_vehicle_log_contract c
                                WHERE c.vehicle_id = v.id
                                  AND c.company_id = v.company_id
                                  AND c.active IS TRUE
                                  AND c.state = 'open')
               AND v.company_id IN %s
               AND v.active IS TRUE
          GROUP BY v.id
        """, (tuple(self.env.companies.ids), ))
        vehicles_no_contract = [vid[0] for vid in self.env.cr.fetchall()]

        if vehicles_no_contract:
            no_contract = _('Vehicles With Drivers And Without Running Contract')
            res.append({
                'string': no_contract,
                'count': len(vehicles_no_contract),
                'action': self._dashboard_default_action(no_contract, 'fleet.vehicle', vehicles_no_contract),
            })

        return res
