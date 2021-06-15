# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models

class PlanningSlot(models.Model):
    _inherit = 'planning.slot'

    # -----------------------------------------------------------------
    # ORM Override
    # -----------------------------------------------------------------

    def _name_get_fields(self):
        """ List of fields that can be displayed in the name_get """
        # Ensure this will be displayed in the right order
        name_get_fields = [item for item in super()._name_get_fields() if item not in ['sale_line_id', 'project_id', 'task_id']]
        return name_get_fields + ['sale_line_id', 'project_id', 'task_id']
