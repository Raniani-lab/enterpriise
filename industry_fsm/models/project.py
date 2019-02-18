# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from math import ceil
from datetime import timedelta

from odoo import fields, models, api, _
from odoo.exceptions import UserError


class Project(models.Model):
    _inherit = "project.project"

    product_template_ids = fields.Many2many('product.template', help="Products allowed to be added on this Task's Material", string="Allowed Products")
    allow_billable = fields.Boolean('Allow to bill Tasks')
    timesheet_product_id = fields.Many2one('product.product', string='Timesheet Product', domain=[('type', '=', 'service'), ('invoice_policy', '=', 'delivery'), ('service_type', '=', 'timesheet')], help="Product of the sales order item. Must be a service invoiced based on timesheets on tasks.")


class Task(models.Model):
    _inherit = "project.task"

    allow_billable = fields.Boolean(related='project_id.allow_billable')
    planning_overlap = fields.Integer(compute='_compute_planning_overlap')
    quotation_count = fields.Integer(compute='_compute_quotation_count')
    material_line_ids = fields.One2many('product.task.map', 'task_id')
    product_template_ids = fields.Many2many(related='project_id.product_template_ids')
    material_line_product_count = fields.Integer(compute='_compute_material_line_product_count')
    material_line_total_price = fields.Integer(compute='_compute_material_line_total_price')
    currency_id = fields.Many2one('res.currency', related='company_id.currency_id', readonly=True)
    fsm_is_done = fields.Boolean('Task Done', default=False, tracking=True)
    partner_email = fields.Char(related='partner_id.email', string='Email ')
    partner_phone = fields.Char(related='partner_id.phone')
    partner_mobile = fields.Char(related='partner_id.mobile')

    @api.depends('planned_date_begin', 'planned_date_end')
    def _compute_planning_overlap(self):
        for task in self:
            overlap = self.env['project.task'].search_count([('allow_planning', '=', True),
                                                             ('user_id.id', '=', task.user_id.id),
                                                             ('planned_date_begin', '<=', task.planned_date_end),
                                                             ('planned_date_end', '>=', task.planned_date_begin)])
            if task.id and overlap:
                overlap -= 1
            task.planning_overlap = overlap

    def _compute_quotation_count(self):
        quotation_data = self.env['sale.order'].read_group([('state', '<>', 'cancel'), ('task_id', 'in', self.ids)], ['task_id'], ['task_id'])
        mapped_data = dict([(q['task_id'][0], q['task_id_count']) for q in quotation_data])
        for task in self:
            task.quotation_count = mapped_data.get(task.id, 0)

    def _compute_material_line_product_count(self):
        material_data = self.env['product.task.map'].read_group([('task_id', 'in', self.ids)], ['quantity', 'task_id'], ['task_id'])
        mapped_quantities = dict([(m['task_id'][0], m['quantity']) for m in material_data])
        for task in self:
            task.material_line_product_count = mapped_quantities.get(task.id, 0)

    def _compute_material_line_total_price(self):
        for task in self:
            total_price = sum(task.material_line_ids.mapped(lambda line: line.quantity * line.product_id.lst_price))
            task.material_line_total_price = total_price

    @api.onchange('planned_hours')
    def _onchange_planned_hours(self):
        if self.planned_date_begin and self.planned_hours:
            self.planned_date_end = self.planned_date_begin + timedelta(days=ceil(self.planned_hours / 8))

    def action_view_timesheets(self):
        kanban_view = self.env.ref('hr_timesheet.view_kanban_account_analytic_line')
        form_view = self.env.ref('industry_fsm.timesheet_view_form')
        domain = [('task_id', '=', self.id)]
        return {'type': 'ir.actions.act_window',
                'name': 'Time',
                'res_model': 'account.analytic.line',
                'view_mode': 'list,form,kanban',
                'views': [(False, 'list'), (kanban_view.id, 'kanban'), (form_view.id, 'form')],
                'domain': domain,
                }

    # Quotations
    def action_create_quotation(self):
        partner_id = self.partner_id.id if self.partner_id else False
        view_form_id = self.env.ref('sale.view_order_form').id
        action = self.env.ref('sale.action_quotations').read()[0]
        action.update({
            'views': [(view_form_id, 'form')],
            'view_mode': 'form',
            'name': self.name,
            'context': {
                'form_view_initial_mode': 'edit',
                'default_partner_id': partner_id,
                'default_state': 'draft',
                'default_task_id': self.id
            },
        })
        return action

    def action_view_created_quotations(self):
        view_tree_id = self.env.ref('sale.view_order_tree').id
        action = self.env.ref('sale.action_quotations').read()[0]
        action.update({
            'view_id': view_tree_id,
            'name': self.name,
            'domain': [('task_id', '=', self.id)],
        })
        return action

    def create_or_view_created_quotations(self):
        if not self.timesheet_ids:
            raise UserError(_("You haven't started this task yet!"))
        if self.quotation_count == 0:
            return self.action_create_quotation()
        else:
            return self.action_view_created_quotations()

    def action_view_material(self):
        if not self.timesheet_ids:
            raise UserError(_("You haven't started this task yet!"))
        kanban_view = self.env.ref('industry_fsm.view_product_product_kanban_material')
        domain = [('id', 'in', self.product_template_ids.ids)] if self.product_template_ids else False
        return {'type': 'ir.actions.act_window',
                'name': 'Time',
                'res_model': 'product.product',
                'views': [(kanban_view.id, 'kanban')],
                'domain': domain,
                'context': {'default_task_id': self.id}
                }

    def action_make_billable(self):
        """ Override to set the selected timesheet_product_id by default in the
            'create sale order from task' wizard
        """
        action = super(Task, self).action_make_billable()
        product = self.project_id.timesheet_product_id
        if product:
            action['context']['default_product_id'] = product.id
        return action

    # "Done" Button logic
    def action_set_done(self):
        """ Moves Task to next stage.
            If billable and user has privileges, create SO confirmed with time and material.
            TODO: Validate stockmoves.
            TODO: Opens popup with confirmation email for customer.
        """
        for record in self:
            if record.timesheet_timer_start:
                return record.with_context({'task_done': True}).action_timer_stop()
            if record.allow_billable:
                has_access = self.env['sale.order'].check_access_rights('create', raise_exception=False) and self.env['sale.order.line'].check_access_rights('create', raise_exception=False)
                if has_access:
                    record.create_or_update_sale_order()
            current = None
            for stage in record.project_id.type_ids:   #it's ok to iterate as it does not return a lot of record, and it allows us to keep the right order
                if not current:
                    if stage.id == self.stage_id.id:
                        current = True
                else:
                    record.stage_id = stage.id
                    break
            record.fsm_is_done = True

    def create_or_update_sale_order(self):
        if self.sale_line_id:
            sale_order = self.sale_line_id.order_id
            self._add_material_to_sale_order(sale_order)
        elif self.partner_id:
            client_order_ref = "{}/{}".format(self.project_id.name, self.name)
            sale_order = self.env['sale.order'].create({
                'partner_id': self.partner_id.id,
                'analytic_account_id': self.project_id.analytic_account_id.id,
                'client_order_ref': client_order_ref,
            })
            sale_order_line = self.env['sale.order.line'].create({
                'order_id': sale_order.id,
                'product_id': self.project_id.timesheet_product_id.id,
                'project_id': self.project_id.id,
                'task_id': self.id,
                'product_uom_qty': self.total_hours_spent,
            })

            self.sale_line_id = sale_order_line.id

            # assign SOL to timesheets
            self.env['account.analytic.line'].search([
                ('task_id', '=', self.id),
                ('so_line', '=', False),
                ('project_id', '!=', False)]).write({
                    'so_line': sale_order_line.id
                })

            self._add_material_to_sale_order(sale_order)
            sale_order.action_confirm()

    def _add_material_to_sale_order(self, sale_order):
        for line in self.material_line_ids:
            existing_line = self.env['sale.order.line'].search([('order_id', '=', sale_order.id), ('product_id', '=', line.product_id.id)], limit=1)
            if existing_line:
                existing_line.product_uom_qty += line.quantity
            else:
                self.env['sale.order.line'].create({
                    'order_id': sale_order.id,
                    'product_id': line.product_id.id,
                    'product_uom_qty': line.quantity
                })
