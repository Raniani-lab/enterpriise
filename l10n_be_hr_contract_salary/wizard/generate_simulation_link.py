# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _


class GenerateSimulationLink(models.TransientModel):
    _inherit = 'generate.simulation.link'

    contract_type_id = fields.Many2one('hr.contract.type', "Contract Type",
                                       default=lambda self: self.env.ref('l10n_be_hr_payroll.l10n_be_contract_type_cdi',
                                                                         raise_if_not_found=False))

    new_car = fields.Boolean(string="Force New Cars List", help="The employee will be able to choose a new car even if the maximum number of used cars available is reached.")
    car_id = fields.Many2one('fleet.vehicle', string='Company Car',
        domain="""['&',('vehicle_type', '=', 'car'), '&', ('future_driver_id', '=', False), '|', ('driver_id', '=', False), ('plan_to_change_car', '=', True)]""",
        help="Default employee's company car. If left empty, the default value will be the employee's current car.")

    def _get_url_triggers(self):
        res = super()._get_url_triggers()
        return res + ['new_car', 'car_id', 'contract_type_id']
