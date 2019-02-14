# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields


class User(models.Model):
    _inherit = ['res.users']

    appraisal_by_manager = fields.Boolean(related='employee_ids.appraisal_by_manager')
    appraisal_manager_ids = fields.Many2many(related='employee_ids.appraisal_manager_ids')
    appraisal_manager_survey_id = fields.Many2one(related='employee_ids.appraisal_manager_survey_id')

    appraisal_self = fields.Boolean(related='employee_ids.appraisal_self', string="By Employee")
    appraisal_employee = fields.Char(related='employee_ids.appraisal_employee')
    appraisal_self_survey_id = fields.Many2one(related='employee_ids.appraisal_self_survey_id')

    appraisal_by_collaborators = fields.Boolean(related='employee_ids.appraisal_by_collaborators')
    appraisal_collaborators_ids = fields.Many2many(related='employee_ids.appraisal_collaborators_ids')
    appraisal_collaborators_survey_id = fields.Many2one(related='employee_ids.appraisal_collaborators_survey_id')

    appraisal_by_colleagues = fields.Boolean(related='employee_ids.appraisal_by_colleagues')
    appraisal_colleagues_ids = fields.Many2many(related='employee_ids.appraisal_colleagues_ids')
    appraisal_colleagues_survey_id = fields.Many2one(related='employee_ids.appraisal_colleagues_survey_id')

    appraisal_date = fields.Date(related='employee_ids.appraisal_date')

    def __init__(self, pool, cr):
        """ Override of __init__ to add access rights.
            Access rights are disabled by default, but allowed
            on some specific fields defined in self.SELF_{READ/WRITE}ABLE_FIELDS.
        """
        appraisal_readable_fields = [
            'appraisal_by_manager',
            'appraisal_manager_ids',
            'appraisal_manager_survey_id',
            'appraisal_self',
            'appraisal_employee',
            'appraisal_self_survey_id',
            'appraisal_by_collaborators',
            'appraisal_collaborators_ids',
            'appraisal_collaborators_survey_id',
            'appraisal_by_colleagues',
            'appraisal_colleagues_ids',
            'appraisal_colleagues_survey_id',
            'appraisal_date',
        ]
        init_res = super(User, self).__init__(pool, cr)
        # duplicate list to avoid modifying the original reference
        type(self).SELF_READABLE_FIELDS = appraisal_readable_fields + type(self).SELF_READABLE_FIELDS
        return init_res
