# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _

class GenerateSimulationLink(models.TransientModel):
    _inherit = 'generate.simulation.link'

    car_id = fields.Many2one('fleet.vehicle', store=True)
    new_car = fields.Boolean('Can request a new car')
    contract_type = fields.Selection([
        ('PFI', 'PFI'),
        ('CDI', 'CDI'),
        ('CDD', 'CDD')], string="Contract Type", default="PFI")
    customer_relation = fields.Boolean("In relations with customers", default=True)

    def _get_url_triggers(self):
        res = super()._get_url_triggers()
        return res + ['car_id', 'customer_relation', 'contract_type', 'new_car']

    @api.onchange('contract_id')
    def _onchange_contract_id(self):
        super()._onchange_contract_id()
        if self.contract_id.car_id:
            self.car_id = self.contract_id.car_id
