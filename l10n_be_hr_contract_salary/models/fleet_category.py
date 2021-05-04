# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import _, models
from odoo.exceptions import ValidationError

class FleetCategory(models.Model):
    _inherit = 'fleet.category'

    def write(self, vals):
        if any(item in vals for item in ('active', 'internal')):
            company_internal_fleets = self.mapped('company_id.internal_fleet_category_id')
            if company_internal_fleets & self:
                #Prevent editing those fields if the fleet is used as default internal fleet for the company
                raise ValidationError(_('This change on the default fleet of Salary Configurator is not allowed.'))
        return super().write(vals)
