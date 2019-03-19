# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields, api


class User(models.Model):
    _inherit = ['res.users']

    appraisal_by_manager = fields.Boolean(related='employee_ids.appraisal_by_manager')
    appraisal_manager_ids = fields.Many2many(related='employee_ids.appraisal_manager_ids')
    appraisal_self = fields.Boolean(related='employee_ids.appraisal_self', string="Employee Himself")
    appraisal_by_collaborators = fields.Boolean(related='employee_ids.appraisal_by_collaborators')
    appraisal_collaborators_ids = fields.Many2many(related='employee_ids.appraisal_collaborators_ids')
    appraisal_by_colleagues = fields.Boolean(related='employee_ids.appraisal_by_colleagues')
    appraisal_colleagues_ids = fields.Many2many(related='employee_ids.appraisal_colleagues_ids')
    appraisal_date = fields.Date(related='employee_ids.appraisal_date')

    def __init__(self, pool, cr):
        """ Override of __init__ to add access rights.
            Access rights are disabled by default, but allowed
            on some specific fields defined in self.SELF_{READ/WRITE}ABLE_FIELDS.
        """
        appraisal_readable_fields = [
            'appraisal_by_manager',
            'appraisal_manager_ids',
            'appraisal_self',
            'appraisal_by_collaborators',
            'appraisal_collaborators_ids',
            'appraisal_by_colleagues',
            'appraisal_colleagues_ids',
            'appraisal_date',
        ]
        init_res = super(User, self).__init__(pool, cr)
        # duplicate list to avoid modifying the original reference
        type(self).SELF_READABLE_FIELDS = appraisal_readable_fields + type(self).SELF_READABLE_FIELDS
        return init_res

    @api.multi
    def action_send_appraisal_request(self):
        return {
            'type': 'ir.actions.act_window',
            'view_type': 'form',
            'view_mode': 'form',
            'res_model': 'request.appraisal',
            'target': 'new',
            'name': 'Appraisal Request',
            'context': self.env.context,
        }
