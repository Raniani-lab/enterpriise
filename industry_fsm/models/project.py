# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from ast import literal_eval
from datetime import timedelta, datetime

from odoo import fields, models, api, _
from odoo.exceptions import UserError, AccessError
from odoo.osv import expression


class Project(models.Model):
    _inherit = "project.project"

    @api.model
    def default_get(self, fields):
        """ Pre-fill timesheet product as "Time" data product when creating new project allowing billable tasks by default. """
        result = super(Project, self).default_get(fields)
        if 'timesheet_product_id' in fields and not result.get('timesheet_product_id'):
            default_product = self.env.ref('industry_fsm.fsm_time_product', False)
            if default_product:
                result['timesheet_product_id'] = default_product.id
        return result

    is_fsm = fields.Boolean("Field Service", default=False, help="Display tasks in the Field Service module and allow planning with start/end dates.")
    allow_material = fields.Boolean("Products on Tasks")
    allow_quotations = fields.Boolean("Extra quotation")
    timesheet_product_id = fields.Many2one('product.product', string='Timesheet Product', domain="[('type', '=', 'service'), ('invoice_policy', '=', 'delivery'), ('service_type', '=', 'timesheet'), '|', ('company_id', '=', False), ('company_id', '=', company_id)]", help='Select a Service product with which you would like to bill your time spent on tasks.')

    _sql_constraints = [
        ('material_imply_billable', "CHECK((allow_material = 't' AND allow_billable = 't') OR (allow_material = 'f'))", 'The material can be allowed only when the task can be billed.'),
        ('timesheet_product_required_if_billable_and_timesheets', "CHECK((allow_billable = 't' AND allow_timesheets = 't' AND timesheet_product_id IS NOT NULL) OR (allow_billable = 'f') OR (allow_timesheets = 'f'))", 'The timesheet product is required when the task can be billed and timesheets are allowed.'),
        ('fsm_imply_task_rate', "CHECK((is_fsm = 't' AND sale_line_id IS NULL) OR (is_fsm = 'f'))", 'An FSM project must be billed at task rate.'),
    ]

    @api.onchange('allow_billable')
    def _onchange_allow_billable(self):
        super(Project, self)._onchange_allow_billable()
        if not self.allow_billable:
            self.allow_material = False


class Task(models.Model):
    _inherit = "project.task"

    @api.model
    def default_get(self, fields_list):
        result = super(Task, self).default_get(fields_list)
        if 'project_id' in fields_list and not result.get('project_id') and self._context.get('fsm_mode'):
            fsm_project = self.env['project.project'].search([('is_fsm', '=', True)], order='sequence', limit=1)
            result['project_id'] = fsm_project.id
        return result

    def _default_planned_date_begin(self):
        if self.env.context.get('fsm_mode'):
            now = datetime.now()
            return now + timedelta(minutes=15 - now.minute % 15, seconds=-now.second)

    def _default_planned_date_end(self):
        if self.env.context.get('fsm_mode'):
            now = datetime.now()
            return now + timedelta(minutes=15 - now.minute % 15, seconds=-now.second) + timedelta(hours=1)

    is_fsm = fields.Boolean(related='project_id.is_fsm', search='_search_is_fsm')
    allow_material = fields.Boolean(related='project_id.allow_material')
    allow_quotations = fields.Boolean(related='project_id.allow_quotations')
    planning_overlap = fields.Integer(compute='_compute_planning_overlap')
    quotation_count = fields.Integer(compute='_compute_quotation_count')
    material_line_product_count = fields.Integer(compute='_compute_material_line_totals')
    material_line_total_price = fields.Float(compute='_compute_material_line_totals')
    currency_id = fields.Many2one('res.currency', related='company_id.currency_id', readonly=True)
    fsm_state = fields.Selection([('draft', 'New'), ('validated', 'Validated'), ('sold', 'Sold')], default='draft', string='Status', readonly=True, copy=False)
    planned_date_begin = fields.Datetime(default=_default_planned_date_begin)
    planned_date_end = fields.Datetime(default=_default_planned_date_end)
    user_id = fields.Many2one(group_expand='_read_group_user_ids')
    invoice_count = fields.Integer("Number of invoices", related='sale_order_id.invoice_count')
    fsm_to_invoice = fields.Boolean("To invoice", compute='_compute_fsm_to_invoice', search='_search_fsm_to_invoice')

    @api.model
    def _search_is_fsm(self, operator, value):
        query = """
            SELECT p.id
            FROM project_project P
            WHERE P.active = 't' AND P.is_fsm
        """
        operator_new = operator == "=" and "inselect" or "not inselect"
        return [('project_id', operator_new, (query, ()))]

    @api.model
    def _read_group_user_ids(self, users, domain, order):
        if self.env.context.get('fsm_mode'):
            recently_created_tasks = self.env['project.task'].search([
                ('create_date', '>', datetime.now() - timedelta(days=30)),
                ('is_fsm', '=', True),
                ('user_id', '!=', False)
            ])
            search_domain = ['|', '|', ('id', 'in', users.ids), ('groups_id', 'in', self.env.ref('industry_fsm.group_fsm_user').id), ('id', 'in', recently_created_tasks.mapped('user_id.id'))]
            return users.search(search_domain, order=order)
        return users

    @api.depends('planned_date_begin', 'planned_date_end', 'user_id')
    def _compute_planning_overlap(self):
        if self.ids:
            query = """
                SELECT
                    T1.id, COUNT(T2.id)
                FROM
                    (
                        SELECT
                            T.id as id,
                            T.user_id as user_id,
                            T.project_id,
                            T.planned_date_begin as planned_date_begin,
                            T.planned_date_end as planned_date_end,
                            T.active as active
                        FROM project_task T
                        LEFT OUTER JOIN project_project P ON P.id = T.project_id
                        WHERE T.id IN %s
                            AND T.active = 't'
                            AND P.is_fsm = 't'
                            AND T.planned_date_begin IS NOT NULL
                            AND T.planned_date_end IS NOT NULL
                            AND T.project_id IS NOT NULL
                    ) T1
                INNER JOIN project_task T2
                    ON T1.id != T2.id
                        AND T2.active = 't'
                        AND T1.user_id = T2.user_id
                        AND T2.planned_date_begin IS NOT NULL
                        AND T2.planned_date_end IS NOT NULL
                        AND T2.project_id IS NOT NULL
                        AND (T1.planned_date_begin::TIMESTAMP, T1.planned_date_end::TIMESTAMP)
                            OVERLAPS (T2.planned_date_begin::TIMESTAMP, T2.planned_date_end::TIMESTAMP)
                GROUP BY T1.id
            """
            self.env.cr.execute(query, (tuple(self.ids),))
            raw_data = self.env.cr.dictfetchall()
            overlap_mapping = dict(map(lambda d: d.values(), raw_data))
            for task in self:
                task.planning_overlap = overlap_mapping.get(task.id, 0)
        else:
            self.planning_overlap = False

    def _compute_quotation_count(self):
        quotation_data = self.sudo().env['sale.order'].read_group([('state', '!=', 'cancel'), ('task_id', 'in', self.ids)], ['task_id'], ['task_id'])
        mapped_data = dict([(q['task_id'][0], q['task_id_count']) for q in quotation_data])
        for task in self:
            task.quotation_count = mapped_data.get(task.id, 0)

    def _compute_material_line_totals(self):
        for task in self:
            material_sale_lines = task.sudo().sale_order_id.order_line.filtered(lambda sol: sol.product_id != task.project_id.timesheet_product_id and sol.product_uom_qty != 0)
            task.material_line_total_price = sum(material_sale_lines.mapped('price_total'))
            task.material_line_product_count = len(material_sale_lines.mapped('product_id'))

    @api.depends('sale_order_id.invoice_status', 'sale_order_id.order_line')
    def _compute_fsm_to_invoice(self):
        for task in self:
            task.fsm_to_invoice = bool(task.sale_order_id.invoice_status not in ('no', 'invoiced'))

    @api.model
    def _search_fsm_to_invoice(self, operator, value):
        query = """
            SELECT so.id
            FROM sale_order so
            WHERE so.invoice_status != 'invoiced'
                AND so.invoice_status != 'no'
        """
        operator_new = 'inselect'
        if(bool(operator == '=') ^ bool(value)):
            operator_new = 'not inselect'
        return [('sale_order_id', operator_new, (query, ()))]

    # ---------------------------------------------------------
    # Actions
    # ---------------------------------------------------------

    def action_view_timesheets(self):
        kanban_view = self.env.ref('hr_timesheet.view_kanban_account_analytic_line')
        form_view = self.env.ref('industry_fsm.timesheet_view_form')
        tree_view = self.env.ref('industry_fsm.timesheet_view_tree_user_inherit')
        return {
            'type': 'ir.actions.act_window',
            'name': _('Time'),
            'res_model': 'account.analytic.line',
            'view_mode': 'list,form,kanban',
            'views': [(tree_view.id, 'list'), (kanban_view.id, 'kanban'), (form_view.id, 'form')],
            'domain': [('task_id', '=', self.id), ('project_id', '!=', False)],
            'context': {
                'fsm_mode': True,
                'default_project_id': self.project_id.id,
                'default_task_id': self.id,
            }
        }

    def action_view_invoices(self):
        invoices = self.mapped('sale_order_id.invoice_ids')
        # prevent view with onboarding banner
        list_view = self.env.ref('account.view_move_tree')
        form_view = self.env.ref('account.view_move_form')
        if len(invoices) == 1:
            return {
                'type': 'ir.actions.act_window',
                'name': _('Invoice'),
                'res_model': 'account.move',
                'view_mode': 'form',
                'views': [[form_view.id, 'form']],
                'res_id': invoices.id,
            }
        return {
            'type': 'ir.actions.act_window',
            'name': _('Invoices'),
            'res_model': 'account.move',
            'view_mode': 'list,form',
            'views': [[list_view.id, 'list'], [form_view.id, 'form']],
            'domain': [('id', 'in', invoices.ids)],
        }

    def action_fsm_create_quotation(self):
        view_form_id = self.env.ref('sale.view_order_form').id
        action = self.env.ref('sale.action_quotations').read()[0]
        action.update({
            'views': [(view_form_id, 'form')],
            'view_mode': 'form',
            'name': self.name,
            'context': {
                'fsm_mode': True,
                'form_view_initial_mode': 'edit',
                'default_partner_id': self.partner_id.id,
                'default_state': 'draft',
                'default_task_id': self.id
            },
        })
        return action

    def action_fsm_view_quotations(self):
        action = self.env.ref('sale.action_quotations').read()[0]
        action.update({
            'name': self.name,
            'domain': [('task_id', '=', self.id)],
            'context': {
                'fsm_mode': True,
                'default_task_id': self.id,
                'default_partner_id': self.partner_id.id},
        })
        if self.quotation_count == 1:
            action['res_id'] = self.env['sale.order'].search([('task_id', '=', self.id)]).id
            action['views'] = [(self.env.ref('sale.view_order_form').id, 'form')]
        return action

    def action_fsm_view_material(self):
        self._fsm_ensure_sale_order()

        domain = [('sale_ok', '=', True)]
        if self.project_id and self.project_id.timesheet_product_id:
            domain = expression.AND([domain, [('id', '!=', self.project_id.timesheet_product_id.id)]])
        deposit_product = self.env['ir.config_parameter'].sudo().get_param('sale.default_deposit_product_id')
        if deposit_product:
            domain = expression.AND([domain, [('id', '!=', deposit_product)]])

        kanban_view = self.env.ref('industry_fsm.view_product_product_kanban_material')
        return {
            'type': 'ir.actions.act_window',
            'name': _('Choose Products'),
            'res_model': 'product.product',
            'views': [(kanban_view.id, 'kanban'), (False, 'form')],
            'domain': domain,
            'context': {
                'fsm_mode': True,
                'create': self.env['product.template'].check_access_rights('create', raise_exception=False),
                'fsm_task_id': self.id,  # avoid 'default_' context key as we are going to create SOL with this context
                'pricelist': self.partner_id.property_product_pricelist.id if self.partner_id else False,
                'partner': self.partner_id.id if self.partner_id else False,
            },
            'help': _("""<p class="o_view_nocontent_smiling_face">
                            Create a new product
                        </p><p>
                            You must define a product for everything you sell or purchase,
                            whether it's a storable product, a consumable or a service.
                        </p>""")
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

    def action_fsm_validate(self):
        """ Moves Task to next stage.
            If allow billable on task, timesheet product set on project and user has privileges :
            Create SO confirmed with time and material.
        """
        for task in self:
            # determine closed stage for task
            closed_stage = task.project_id.type_ids.filtered(lambda stage: stage.is_closed)
            if not closed_stage and len(task.project_id.type_ids) > 1:  # project without stage (or with only one)
                closed_stage = task.project_id.type_ids[-1]

            values = {'fsm_state': 'validated'}
            if closed_stage:
                values['stage_id'] = closed_stage.id

            if task.allow_billable:
                task._fsm_ensure_sale_order()
                if task.sudo().sale_order_id.state in ['draft', 'sent']:
                    task.sudo().sale_order_id.action_confirm()

            task.write(values)

    def action_fsm_create_invoice(self):
        if not all(self.mapped('is_fsm')):
            raise UserError(_('This action is only allowed on FSM project.'))
        for task in self:
            # ensure the SO exists before invoicing, then confirm it
            task._fsm_ensure_sale_order()
            if task.sale_order_id.state in ['draft', 'sent']:
                task.sale_order_id.action_confirm()

            # as before, mark the task as 'sold' on SO confirmation
            task.write({'fsm_state': 'sold'})
        # redirect create invoice wizard (of the Sales Order)
        action = self.env.ref('sale.action_view_sale_advance_payment_inv').read()[0]
        context = literal_eval(action.get('context', "{}"))
        context.update({
            'active_ids': self.mapped('sale_order_id').ids,
        })
        action['context'] = context
        return action

    def action_fsm_view_overlapping_tasks(self):
        fsm_task_form_view = self.env.ref('industry_fsm.project_task_view_form')
        fsm_task_list_view = self.env.ref('industry_fsm.project_task_view_list_fsm')
        domain = self._get_fsm_overlap_domain()[self.id]
        return {
            'type': 'ir.actions.act_window',
            'name': _('Overlapping Tasks'),
            'res_model': 'project.task',
            'domain': domain,
            'views': [(fsm_task_list_view.id, 'tree'), (fsm_task_form_view.id, 'form')],
            'context': {
                'fsm_mode': True,
                'task_nameget_with_hours': False,
            }
        }

    # ---------------------------------------------------------
    # Business Methods
    # ---------------------------------------------------------

    def _fsm_ensure_sale_order(self):
        """ get the SO of the task. If no one, create it and return it """
        if self.sale_order_id:
            return self.sale_order_id
        return self._fsm_create_sale_order()

    def _fsm_create_sale_order(self):
        """ Create the SO from the task, with the 'service product' sales line and link all timesheet to that line it """
        if not self.partner_id:
            raise UserError(_('The FSM task must have a customer set to be sold.'))

        SaleOrder = self.env['sale.order']
        if self.user_has_groups('industry_fsm.group_fsm_user'):
            SaleOrder = SaleOrder.sudo()

        sale_order = SaleOrder.create({
            'partner_id': self.partner_id.id,
            'analytic_account_id': self.project_id.analytic_account_id.id,
        })
        sale_order.onchange_partner_id()

        assign_current_user = self.env['sale.order'].check_access_rights('create', raise_exception=False)
        if(not assign_current_user):
            # write after creation since onchange_partner_id sets the current user
            sale_order.write({'user_id': False})

        sale_order_line = self.env['sale.order.line'].sudo().create({
            'order_id': sale_order.id,
            'product_id': self.project_id.timesheet_product_id.id,
            'project_id': self.project_id.id,
            'task_id': self.id,
            'product_uom_qty': self.total_hours_spent,
            'product_uom': self.project_id.timesheet_product_id.uom_id.id,
        })
        self.write({
            'sale_line_id': sale_order_line.id,
        })

        # assign SOL to timesheets
        self.env['account.analytic.line'].sudo().search([
            ('task_id', '=', self.id),
            ('so_line', '=', False),
            ('project_id', '!=', False)
        ]).write({
            'so_line': sale_order_line.id
        })
        return sale_order

    def _get_fsm_overlap_domain(self):
        domain_mapping = {}
        for task in self:
            domain_mapping[task.id] = [
                '&',
                    '&',
                        '&',
                            ('is_fsm', '=', True),
                            ('user_id', '=', task.user_id.id),
                        '&',
                            ('planned_date_begin', '<', task.planned_date_end),
                            ('planned_date_end', '>', task.planned_date_begin),
                    ('project_id', '!=', False)
            ]
            current_id = task._origin.id
            if current_id:
                domain_mapping[task.id] = expression.AND([domain_mapping[task.id], [('id', '!=', current_id)]])
        return domain_mapping
