# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from dateutil.relativedelta import relativedelta
from datetime import date
from lxml import etree

from odoo import api, fields, models, _
from odoo.tools import date_utils
from odoo.exceptions import UserError
from odoo.addons.l10n_be_hr_payroll.models.hr_dmfa import DMFANode, format_amount


class DMFACompanyVehicle(DMFANode):

    def __init__(self, vehicle, sequence=1):
        super().__init__(vehicle.env, sequence=sequence)
        self.license_plate = vehicle.license_plate
        self.eco_vehicle = -1


class HrDMFAReport(models.Model):
    _inherit = 'l10n_be.dmfa'

    vehicle_ids = fields.One2many('fleet.vehicle', compute='_compute_vehicle_ids')

    @api.depends('quarter_end')
    def _compute_vehicle_ids(self):
        for dmfa in self:
            vehicles = self.env['hr.payslip'].search([
                # ('employee_id', 'in', employees.ids),
                ('date_to', '>=', self.quarter_start),
                ('date_to', '<=', self.quarter_end),
                ('state', 'in', ['done', 'paid']),
                ('company_id', '=', self.company_id.id),
            ]).mapped('vehicle_id')
            dmfa.vehicle_ids = [(6, False, vehicles.ids)]

    def _get_rendering_data(self):
        invalid_vehicles = self.vehicle_ids.filtered(lambda v: len(v.license_plate) > 10)
        if invalid_vehicles:
            raise UserError(_('The following license plates are invalid:\n%s', '\n'.join(invalid_vehicles.mapped('license_plate'))))

        return dict(
            super()._get_rendering_data(),
            vehicles_cotisation=format_amount(self._get_vehicles_contribution()),
            vehicles=DMFACompanyVehicle.init_multi([(vehicle,) for vehicle in self.vehicle_ids]),
        )

    def _get_vehicles_contribution(self):
        amount = 0
        self_sudo = self.sudo()
        for vehicle in self_sudo.vehicle_ids:
            # YTI TODO: Avoid counting vehicles over 3 months if only used 1 time ?
            n_months = min(relativedelta(self_sudo.quarter_end, self_sudo.quarter_start).months, relativedelta(self_sudo.quarter_end, vehicle.first_contract_date).months)
            amount += vehicle.co2_fee * n_months
        return amount

    def _get_global_contribution(self, payslips):
        amount = super()._get_global_contribution(payslips)
        return amount + self._get_vehicles_contribution()
