# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class Project(models.Model):
    _inherit = "project.project"

    allow_material = fields.Boolean("Products on Tasks", compute="_compute_allow_material", store=True, readonly=False)
    allow_quotations = fields.Boolean("Extra Quotations")

    _sql_constraints = [
        ('material_imply_billable', "CHECK((allow_material = 't' AND allow_billable = 't') OR (allow_material = 'f'))", 'The material can be allowed only when the task can be billed.'),
        ('fsm_imply_task_rate', "CHECK((is_fsm = 't' AND sale_line_id IS NULL) OR (is_fsm = 'f'))", 'An FSM project must be billed at task rate.'),
    ]

    @api.model
    def default_get(self, *args, **kwargs):
        defaults = super().default_get(*args, **kwargs)
        if 'allow_quotations' not in defaults and defaults.get('is_fsm'):
            defaults['allow_quotations'] = self.env.user.has_group('industry_fsm_sale.group_fsm_quotation_from_task')
        return defaults

    @api.depends('allow_billable')
    def _compute_allow_billable(self):
        super()._compute_allow_billable()
        for project in self:
            project.allow_material = project.allow_billable

    @api.depends('allow_billable', 'is_fsm')
    def _compute_allow_material(self):
        for project in self:
            if not project._origin:
                project.allow_material = project.is_fsm
            else:
                project.allow_material = project.allow_billable

    def flush(self, fnames=None, records=None):
        if fnames is not None:
            # force 'allow_billable' and 'allow_material' to be flushed
            # altogether in order to satisfy the SQL constraint above
            fnames = set(fnames)
            if 'allow_billable' in fnames or 'allow_material' in fnames:
                fnames.add('allow_billable')
                fnames.add('allow_material')
        return super().flush(fnames, records)
