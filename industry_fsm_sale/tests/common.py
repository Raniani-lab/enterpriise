# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details

from odoo import Command
from odoo.addons.sale_timesheet.tests.common import TestCommonSaleTimesheet


class TestFsmFlowSaleCommon(TestCommonSaleTimesheet):

    @classmethod
    def setUpClass(cls):
        super(TestFsmFlowSaleCommon, cls).setUpClass()

        cls.employee_user2 = cls.env['hr.employee'].create({
            'name': 'Employee User 2',
            'timesheet_cost': 15,
        })

        cls.employee_user3 = cls.env['hr.employee'].create({
            'name': 'Employee User 2',
            'timesheet_cost': 15,
        })

        cls.project_user = cls.env['res.users'].create({
            'name': 'Armande Project_user',
            'login': 'Armande',
            'email': 'armande.project_user@example.com',
            'groups_id': [(6, 0, [cls.env.ref('project.group_project_user').id])]
        })

        cls.fsm_project = cls.env['project.project'].create({
            'name': 'Field Service',
            'is_fsm': True,
            'allow_billable': True,
            'allow_timesheets': True,
        })

        cls.partner_1 = cls.env['res.partner'].create({'name': 'A Test Partner 1'})

        cls.fsm_project_employee_rate = cls.fsm_project.copy({
            'partner_id': cls.partner_1.id,
            'timesheet_product_id': cls.product_order_timesheet2.id,
            'analytic_account_id': cls.analytic_account_sale.id,
            'sale_line_employee_ids': [
                Command.create({
                    'employee_id': cls.employee_user.id,
                    'timesheet_product_id': cls.product_order_timesheet1.id,
                }),
                Command.create({
                    'employee_id': cls.employee_user2.id,
                    'timesheet_product_id': cls.product_delivery_timesheet1.id,
                }),
                Command.create({
                    'employee_id': cls.employee_user3.id,
                    'timesheet_product_id': cls.product_delivery_timesheet2.id,
                })
            ]
        })
        # Compute the _compute_price_id, because this one is not trigger because of the _compute_sale_line_id of this same model in this module.
        cls.fsm_project_employee_rate.sale_line_employee_ids._compute_price_unit()

        cls.task = cls.env['project.task'].with_context({'mail_create_nolog': True}).create({
            'name': 'Fsm task',
            'user_id': cls.project_user.id,
            'project_id': cls.fsm_project.id})

        cls.product_ordered = cls.env['product.product'].create({
            'name': 'Individual Workplace',
            'list_price': 885.0,
            'type': 'service',
            'invoice_policy': 'order',
            'taxes_id': False,
        })
