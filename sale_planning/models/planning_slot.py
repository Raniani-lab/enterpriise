# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import timedelta

from odoo import api, fields, models
from odoo.osv import expression

class PlanningSlot(models.Model):
    _inherit = 'planning.slot'

    start_datetime = fields.Datetime(required=False)
    end_datetime = fields.Datetime(required=False)
    sale_line_id = fields.Many2one('sale.order.line', string='Sales Order Item', domain=[('product_id.type', '=', 'service'), ('state', 'not in', ['draft', 'sent'])],
                                   index=True, group_expand='_group_expand_sale_line_id')
    sale_order_id = fields.Many2one('sale.order', string='Sales Order', related='sale_line_id.order_id', store=True)
    role_product_ids = fields.One2many('product.template', related='role_id.product_ids')
    sale_line_plannable = fields.Boolean(related='sale_line_id.product_id.planning_enabled')

    _sql_constraints = [
        ('check_datetimes_set_or_plannable_slot',
         'CHECK((start_datetime IS NOT NULL AND end_datetime IS NOT NULL) OR sale_line_id IS NOT NULL)',
         'Only slots linked to a sale order with a plannable service can be unscheduled.')
    ]

    @api.depends('sale_line_id')
    def _compute_role_id(self):
        slot_with_sol = self.filtered('sale_line_plannable')
        for slot in slot_with_sol:
            if not slot.role_id:
                slot.role_id = slot.sale_line_id.product_id.planning_role_id
        super(PlanningSlot, self - slot_with_sol)._compute_role_id()

    @api.depends('start_datetime')
    def _compute_allocated_hours(self):
        planned_slots = self.filtered('start_datetime')
        super(PlanningSlot, planned_slots)._compute_allocated_hours()

    @api.depends('start_datetime')
    def _compute_allocated_percentage(self):
        planned_slots = self.filtered('start_datetime')
        super(PlanningSlot, planned_slots)._compute_allocated_percentage()

    @api.depends('start_datetime')
    def _compute_past_shift(self):
        planned_slots = self.filtered('start_datetime')
        (self - planned_slots).is_past = False
        super(PlanningSlot, planned_slots)._compute_past_shift()

    @api.depends('start_datetime')
    def _compute_unassign_deadline(self):
        planned_slots = self.filtered('start_datetime')
        (self - planned_slots).unassign_deadline = False
        super(PlanningSlot, planned_slots)._compute_unassign_deadline()

    @api.depends('start_datetime')
    def _compute_is_unassign_deadline_passed(self):
        planned_slots = self.filtered('start_datetime')
        (self - planned_slots).is_unassign_deadline_passed = False
        super(PlanningSlot, planned_slots)._compute_is_unassign_deadline_passed()

    @api.depends('start_datetime')
    def _compute_working_days_count(self):
        planned_slots = self.filtered('start_datetime')
        (self - planned_slots).working_days_count = 0
        super(PlanningSlot, planned_slots)._compute_working_days_count()

    @api.depends('start_datetime')
    def _compute_template_autocomplete_ids(self):
        planned_slots = self.filtered('start_datetime')
        (self - planned_slots).template_autocomplete_ids = self.template_id
        super(PlanningSlot, planned_slots)._compute_template_autocomplete_ids()

    def _group_expand_sale_line_id(self, sale_lines, domain, order):
        dom_tuples = [(dom[0], dom[1]) for dom in domain if isinstance(dom, (list, tuple)) and len(dom) == 3]
        sale_line_ids = self.env.context.get('filter_sale_line_ids', False)
        if sale_line_ids:
            # search method is used rather than browse since the order needs to be handled
            return self.env['sale.order.line'].search([('id', 'in', sale_line_ids)], order=order)
        elif self._context.get('planning_expand_sale_line_id') and ('start_datetime', '<=') in dom_tuples and ('end_datetime', '>=') in dom_tuples:
            if ('sale_line_id', '=') in dom_tuples or ('sale_line_id', 'ilike') in dom_tuples:
                filter_domain = self._expand_domain_m2o_groupby(domain, 'sale_line_id')
                return self.env['sale.order.line'].search(filter_domain, order=order)
            filters = self._expand_domain_dates(domain)
            sale_lines = self.env['planning.slot'].search(filters).mapped('sale_line_id')
            return sale_lines.search([('id', 'in', sale_lines.ids)], order=order)
        return sale_lines

    # -----------------------------------------------------------------
    # ORM Override
    # -----------------------------------------------------------------

    @api.model
    def default_get(self, fields_list):
        res = super().default_get(fields_list)
        if res.get('sale_line_id'):
            sale_line_id = self.env['sale.order.line'].browse(res.get('sale_line_id'))
            if sale_line_id.product_id.planning_enabled and res.get('start_datetime') and res.get('end_datetime'):
                remaining_hours_to_plan = sale_line_id.planning_hours_to_plan - sale_line_id.planning_hours_planned
                if float_utils.float_compare(remaining_hours_to_plan, 0, precision_digits=2) < 1:
                    res['end_datetime'] = res['start_datetime']
                    return res
                allocated_hours = (res['end_datetime'] - res['start_datetime']).total_seconds() / 3600.0
                if float_utils.float_compare(remaining_hours_to_plan, allocated_hours, precision_digits=2) < 1:
                    res['end_datetime'] = res['start_datetime'] + timedelta(hours=remaining_hours_to_plan)
        return res

    def _name_get_fields(self):
        """ List of fields that can be displayed in the name_get """
        return super()._name_get_fields() + ['sale_line_id']

    # -----------------------------------------------------------------
    # Actions
    # -----------------------------------------------------------------

    def action_view_sale_order(self):
        action = self.env["ir.actions.actions"]._for_xml_id("sale.action_orders")
        action['views'] = [(False, 'form')]
        action['res_id'] = self.sale_order_id.id
        return action

    # -----------------------------------------------------------------
    # Business methods
    # -----------------------------------------------------------------

    def _get_domain_template_slots(self):
        domain = super()._get_domain_template_slots()
        if self.sale_line_plannable:
            domain = expression.AND([domain, ['|', ('role_id', '=', self.sale_line_id.product_id.planning_role_id.id), ('role_id', '=', False)]])
        return domain
