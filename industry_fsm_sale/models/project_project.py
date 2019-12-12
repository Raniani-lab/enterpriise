# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class Project(models.Model):
    _inherit = "project.project"

    allow_billable = fields.Boolean("Bill from Tasks", compute='_compute_allow_billable', store=True, readonly=False)
    allow_material = fields.Boolean("Products on Tasks", compute="_compute_allow_material", store=True, readonly=False)
    allow_quotations = fields.Boolean("Extra Quotations")
    timesheet_product_id = fields.Many2one(
        'product.product', string='Timesheet Product',
        compute='_compute_timesheet_product_id', store=True, readonly=False,
        domain="""[
            ('type', '=', 'service'),
            ('invoice_policy', '=', 'delivery'),
            ('service_type', '=', 'timesheet'),
            '|', ('company_id', '=', False), ('company_id', '=', company_id)]""",
        help='Select a Service product with which you would like to bill your time spent on tasks.')
    allow_timesheets = fields.Boolean(default=True)
    allow_timesheet_timer = fields.Boolean(default=True)

    _sql_constraints = [
        ('material_imply_billable', "CHECK((allow_material = 't' AND allow_billable = 't') OR (allow_material = 'f'))", 'The material can be allowed only when the task can be billed.'),
        ('timesheet_product_required_if_billable_and_timesheets', "CHECK((allow_billable = 't' AND allow_timesheets = 't' AND timesheet_product_id IS NOT NULL) OR (allow_billable = 'f') OR (allow_timesheets = 'f') OR (is_fsm = 'f'))", 'The timesheet product is required when the task can be billed and timesheets are allowed.'),
        ('fsm_imply_task_rate', "CHECK((is_fsm = 't' AND sale_line_id IS NULL) OR (is_fsm = 'f'))", 'An FSM project must be billed at task rate.'),
    ]

    @api.depends('allow_timesheets')
    def _compute_allow_timesheet_timer(self):
        for project in self:
            project.allow_timesheet_timer = project.allow_timesheets

    @api.depends('is_fsm')
    def _compute_allow_timesheets(self):
        for project in self:
            if not project._origin:
                project.allow_timesheets = True

    @api.depends('allow_timesheets', 'allow_billable')
    def _compute_timesheet_product_id(self):
        default_product = self.env.ref('sale_timesheet_enterprise.fsm_time_product', False)
        for project in self:
            if project.allow_timesheets and project.allow_billable and not project.timesheet_product_id:
                self.timesheet_product_id = default_product
            else:
                self.timesheet_product_id = False

    @api.depends('is_fsm')
    def _compute_allow_billable(self):
        for project in self:
            if not project._origin:
                project.allow_billable = project.is_fsm

    @api.depends('allow_billable', 'is_fsm')
    def _compute_allow_material(self):
        for project in self:
            if not project._origin:
                project.allow_material = project.is_fsm
            else:
                project.allow_material = project.allow_billable
