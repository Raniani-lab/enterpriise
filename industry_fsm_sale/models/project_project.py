# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class Project(models.Model):
    _inherit = "project.project"

    @api.model
    def default_get(self, fields):
        """ Pre-fill timesheet product as "Time" data product when creating new project allowing billable tasks by default. """
        result = super(Project, self).default_get(fields)
        if 'timesheet_product_id' in fields and result.get('allow_billable') and result.get('allow_timesheets') and not result.get('timesheet_product_id'):
            default_product = self.env.ref('industry_fsm.fsm_time_product', False)
            if default_product:
                result['timesheet_product_id'] = default_product.id
        return result

    allow_material = fields.Boolean("Products on Tasks")
    allow_quotations = fields.Boolean("Extra Quotations")
    timesheet_product_id = fields.Many2one('product.product', string='Timesheet Product', domain="[('type', '=', 'service'), ('invoice_policy', '=', 'delivery'), ('service_type', '=', 'timesheet'), '|', ('company_id', '=', False), ('company_id', '=', company_id)]", help='Select a Service product with which you would like to bill your time spent on tasks.')

    _sql_constraints = [
        ('material_imply_billable', "CHECK((allow_material = 't' AND allow_billable = 't') OR (allow_material = 'f'))", 'The material can be allowed only when the task can be billed.'),
        ('timesheet_product_required_if_billable_and_timesheets', "CHECK((allow_billable = 't' AND allow_timesheets = 't' AND timesheet_product_id IS NOT NULL) OR (allow_billable = 'f') OR (allow_timesheets = 'f'))", 'The timesheet product is required when the task can be billed and timesheets are allowed.'),
        ('fsm_imply_task_rate', "CHECK((is_fsm = 't' AND sale_line_id IS NULL) OR (is_fsm = 'f'))", 'An FSM project must be billed at task rate.'),
    ]

    @api.onchange('allow_timesheets', 'allow_billable')
    def _onchange_allow_timesheets_and_billable(self):
        if self.allow_timesheets and self.allow_billable and not self.timesheet_product_id:
            default_product = self.env.ref('industry_fsm.fsm_time_product', False)
            if default_product:
                self.timesheet_product_id = default_product
        else:
            self.timesheet_product_id = False

    @api.onchange('allow_billable')
    def _onchange_allow_billable(self):
        super(Project, self)._onchange_allow_billable()
        if self.allow_billable:
            self.allow_material = True
        else:
            self.allow_material = False
