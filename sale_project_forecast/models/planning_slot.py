# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models

class PlanningSlot(models.Model):
    _inherit = 'planning.slot'

    sale_line_id = fields.Many2one(compute='_compute_sale_line_id', store=True, readonly=False)

    @api.depends('sale_line_id.project_id')
    def _compute_project_id(self):
        slot_without_sol_project = self.env['planning.slot']
        for slot in self:
            if not slot.project_id and slot.sale_line_id:
                # Isn't it weird that sale_line_id has a task_id and no project_id
                slot.project_id = slot.sale_line_id.project_id or slot.sale_line_id.task_id.project_id
            if not slot.project_id:
                slot_without_sol_project |= slot
        super(PlanningSlot, slot_without_sol_project)._compute_project_id()

    @api.depends('project_id', 'task_id')
    def _compute_sale_line_id(self):
        for slot in self:
            if not slot.sale_line_id and slot.project_id:
                slot.sale_line_id = slot.task_id.sale_line_id or slot.project_id.sale_line_id

    @api.depends('sale_line_id.task_id')
    def _compute_task_id(self):
        slot_without_sol_task = self.env['planning.slot']
        for slot in self:
            if not slot.task_id and slot.sale_line_id and slot.sale_line_id.task_id and slot.project_id:
                slot.task_id = slot.sale_line_id.task_id
            else:
                slot_without_sol_task |= slot
        super(PlanningSlot, slot_without_sol_task)._compute_task_id()

    @api.depends('task_id')
    def _compute_resource_id(self):
        slot_not_sold = self.filtered_domain([('sale_line_id', '=', False)])
        super(PlanningSlot, slot_not_sold)._compute_resource_id()

    # -----------------------------------------------------------------
    # ORM Override
    # -----------------------------------------------------------------

    def _name_get_fields(self):
        """ List of fields that can be displayed in the name_get """
        # Ensure this will be displayed in the right order
        name_get_fields = [item for item in super()._name_get_fields() if item not in ['sale_line_id', 'project_id', 'task_id']]
        return name_get_fields + ['sale_line_id', 'project_id', 'task_id']
