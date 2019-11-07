# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.account.tests.common import AccountTestCommon
from datetime import datetime


class TestAccountBudgetCommon(AccountTestCommon):

    @classmethod
    def setUpClass(cls):
        super(TestAccountBudgetCommon, cls).setUpClass()
        # In order to check account budget module in Odoo I created a budget with few budget positions
        # Checking if the budgetary positions have accounts or not

        cls.res_partner_2 = cls.env['res.partner'].create({'name': 'Partner 2'})
        cls.res_partner_12 = cls.env['res.partner'].create({'name': 'My Budget Partner 12'})

        cls.analytic_group_projects = cls.env['account.analytic.group'].create({'name': 'Projects'})
        cls.analytic_group_departments = cls.env['account.analytic.group'].create({'name': 'Departments'})

        cls.analytic_partners_camp_to_camp = cls.env['account.analytic.account'].create({
            'name': 'Camp to Camp',
            'partner_id': cls.res_partner_12.id,
            'group_id': cls.analytic_group_projects.id,
        })
        cls.analytic_administratif = cls.env['account.analytic.account'].create({
            'name': 'Administrative',
            'group_id': cls.analytic_group_departments.id,
        })
        cls.analytic_agrolait = cls.env['account.analytic.account'].create({
            'name': 'Deco Addict',
            'partner_id': cls.res_partner_2.id,
            'group_id': cls.analytic_group_projects.id,
        })
        cls.analytic_our_super_product = cls.env['account.analytic.account'].create({
            'name': 'Our Super Product',
            'partner_id': cls.res_partner_2.id,
            'group_id': cls.analytic_group_projects.id,
        })
        cls.analytic_seagate_p2 = cls.env['account.analytic.account'].create({
            'name': 'Seagate P2',
            'partner_id': cls.res_partner_2.id,
            'group_id': cls.analytic_group_projects.id,
        })

        cls._load_crossovered_budgets()

        account_ids = cls.env['account.account'].search([
            ('user_type_id', '=', cls.env.ref('account.data_account_type_revenue').id),
            ('tag_ids.name', 'in', ['Operating Activities'])
        ]).ids
        if not account_ids:
            account_ids = cls.env['account.account'].create({
                'name': 'Product Sales - (test)',
                'code': 'X2020',
                'user_type_id': cls.env.ref('account.data_account_type_revenue').id,
                'tag_ids': [(6, 0, [cls.ref('account.account_tag_operating')])],
            }).ids
        cls.account_budget_post_sales0 = cls.env['account.budget.post'].create({
            'name': 'Sales',
            'account_ids': [(6, None, account_ids)],
        })

        cls.env['crossovered.budget.lines'].create({
            'analytic_account_id': cls.analytic_partners_camp_to_camp.id,
            'general_budget_id': cls.account_budget_post_sales0.id,
            'date_from': str(datetime.now().year + 1) + '-01-01',
            'date_to': str(datetime.now().year + 1) + '-01-31',
            'planned_amount': 500.0,
            'crossovered_budget_id': cls.crossovered_budget_budgetpessimistic0.id,
        })
        cls.env['crossovered.budget.lines'].create({
            'analytic_account_id': cls.analytic_partners_camp_to_camp.id,
            'general_budget_id': cls.account_budget_post_sales0.id,
            'date_from': str(datetime.now().year + 1) + '-02-07',
            'date_to': str(datetime.now().year + 1) + '-02-28',
            'planned_amount': 900.0,
            'crossovered_budget_id': cls.crossovered_budget_budgetpessimistic0.id,
        })
        cls.env['crossovered.budget.lines'].create({
            'analytic_account_id': cls.analytic_partners_camp_to_camp.id,
            'general_budget_id': cls.account_budget_post_sales0.id,
            'date_from': str(datetime.now().year + 1) + '-03-01',
            'date_to': str(datetime.now().year + 1) + '-03-15',
            'planned_amount': 300.0,
            'crossovered_budget_id': cls.crossovered_budget_budgetpessimistic0.id,
        })
        cls.env['crossovered.budget.lines'].create({
            'analytic_account_id': cls.analytic_our_super_product.id,
            'general_budget_id': cls.account_budget_post_sales0.id,
            'date_from': str(datetime.now().year + 1) + '-03-16',
            'paid_date': str(datetime.now().year + 1) + '-12-03',
            'date_to': str(datetime.now().year + 1) + '-03-31',
            'planned_amount': 375.0,
            'crossovered_budget_id': cls.crossovered_budget_budgetpessimistic0.id,
        })
        cls.env['crossovered.budget.lines'].create({
            'analytic_account_id': cls.analytic_our_super_product.id,
            'general_budget_id': cls.account_budget_post_sales0.id,
            'date_from': str(datetime.now().year + 1) + '-05-01',
            'paid_date': str(datetime.now().year + 1) + '-12-03',
            'date_to': str(datetime.now().year + 1) + '-05-31',
            'planned_amount': 375.0,
            'crossovered_budget_id': cls.crossovered_budget_budgetpessimistic0.id,
        })
        cls.env['crossovered.budget.lines'].create({
            'analytic_account_id': cls.analytic_seagate_p2.id,
            'general_budget_id': cls.account_budget_post_sales0.id,
            'date_from': str(datetime.now().year + 1) + '-07-16',
            'date_to': str(datetime.now().year + 1) + '-07-31',
            'planned_amount': 20000.0,
            'crossovered_budget_id': cls.crossovered_budget_budgetpessimistic0.id,
        })
        cls.env['crossovered.budget.lines'].create({
            'analytic_account_id': cls.analytic_seagate_p2.id,
            'general_budget_id': cls.account_budget_post_sales0.id,
            'date_from': str(datetime.now().year + 1) + '-02-01',
            'date_to': str(datetime.now().year + 1) + '-02-28',
            'planned_amount': 20000.0,
            'crossovered_budget_id': cls.crossovered_budget_budgetpessimistic0.id,
        })
        cls.env['crossovered.budget.lines'].create({
            'analytic_account_id': cls.analytic_seagate_p2.id,
            'general_budget_id': cls.account_budget_post_sales0.id,
            'date_from': str(datetime.now().year + 1) + '-09-16',
            'date_to': str(datetime.now().year + 1) + '-09-30',
            'planned_amount': 10000.0,
            'crossovered_budget_id': cls.crossovered_budget_budgetpessimistic0.id,
        })
        cls.env['crossovered.budget.lines'].create({
            'analytic_account_id': cls.analytic_seagate_p2.id,
            'general_budget_id': cls.account_budget_post_sales0.id,
            'date_from': str(datetime.now().year + 1) + '-10-01',
            'date_to': str(datetime.now().year + 1) + '-12-31',
            'planned_amount': 10000.0,
            'crossovered_budget_id': cls.crossovered_budget_budgetpessimistic0.id,
        })

        account_ids = cls.env['account.account'].search([
            ('user_type_id.name', '=', 'Expenses'),
            ('tag_ids.name', 'in', ['Operating Activities'])
        ]).ids

        if not account_ids:
            account_ids = cls.env['account.account'].create({
                'name': 'Expense - (test)',
                'code': 'X2120',
                'user_type_id': cls.ref('account.data_account_type_expenses'),
                'tag_ids': [(6, 0, [cls.ref('account.account_tag_operating')])],
            }).ids
        cls.account_budget_post_purchase0 = cls.env['account.budget.post'].create({
            'name': 'Purchases',
            'account_ids': [(6, None, account_ids)],
        })

        cls.env['crossovered.budget.lines'].create({
            'analytic_account_id': cls.analytic_partners_camp_to_camp.id,
            'general_budget_id': cls.account_budget_post_purchase0.id,
            'date_from': str(datetime.now().year + 1) + '-01-01',
            'date_to': str(datetime.now().year + 1) + '-01-31',
            'planned_amount': -500.0,
            'crossovered_budget_id': cls.crossovered_budget_budgetpessimistic0.id,
        })
        cls.env['crossovered.budget.lines'].create({
            'analytic_account_id': cls.analytic_partners_camp_to_camp.id,
            'general_budget_id': cls.account_budget_post_purchase0.id,
            'date_from': str(datetime.now().year + 1) + '-02-01',
            'date_to': str(datetime.now().year + 1) + '-02-28',
            'planned_amount': -250.0,
            'crossovered_budget_id': cls.crossovered_budget_budgetpessimistic0.id,
        })
        cls.env['crossovered.budget.lines'].create({
            'analytic_account_id': cls.analytic_our_super_product.id,
            'general_budget_id': cls.account_budget_post_purchase0.id,
            'date_from': str(datetime.now().year + 1) + '-04-01',
            'date_to': str(datetime.now().year + 1) + '-04-30',
            'planned_amount': -150.0,
            'crossovered_budget_id': cls.crossovered_budget_budgetpessimistic0.id,
        })
        cls.env['crossovered.budget.lines'].create({
            'analytic_account_id': cls.analytic_seagate_p2.id,
            'general_budget_id': cls.account_budget_post_purchase0.id,
            'date_from': str(datetime.now().year + 1) + '-06-01',
            'date_to': str(datetime.now().year + 1) + '-06-15',
            'planned_amount': -7500.0,
            'crossovered_budget_id': cls.crossovered_budget_budgetpessimistic0.id,
        })
        cls.env['crossovered.budget.lines'].create({
            'analytic_account_id': cls.analytic_seagate_p2.id,
            'general_budget_id': cls.account_budget_post_purchase0.id,
            'date_from': str(datetime.now().year + 1) + '-06-16',
            'date_to': str(datetime.now().year + 1) + '-06-30',
            'planned_amount': -5000.0,
            'crossovered_budget_id': cls.crossovered_budget_budgetpessimistic0.id,
        })
        cls.env['crossovered.budget.lines'].create({
            'analytic_account_id': cls.analytic_seagate_p2.id,
            'general_budget_id': cls.account_budget_post_purchase0.id,
            'date_from': str(datetime.now().year + 1) + '-07-01',
            'date_to': str(datetime.now().year + 1) + '-07-15',
            'planned_amount': -2000.0,
            'crossovered_budget_id': cls.crossovered_budget_budgetpessimistic0.id,
        })
        cls.env['crossovered.budget.lines'].create({
            'analytic_account_id': cls.analytic_seagate_p2.id,
            'general_budget_id': cls.account_budget_post_purchase0.id,
            'date_from': str(datetime.now().year + 1) + '-08-16',
            'date_to': str(datetime.now().year + 1) + '-08-31',
            'planned_amount': -3000.0,
            'crossovered_budget_id': cls.crossovered_budget_budgetpessimistic0.id,
        })
        cls.env['crossovered.budget.lines'].create({
            'analytic_account_id': cls.analytic_seagate_p2.id,
            'general_budget_id': cls.account_budget_post_purchase0.id,
            'date_from': str(datetime.now().year + 1) + '-09-01',
            'date_to': str(datetime.now().year + 1) + '-09-15',
            'planned_amount': -1000.0,
            'crossovered_budget_id': cls.crossovered_budget_budgetpessimistic0.id,
        })

    @classmethod
    def _load_crossovered_budgets(cls):
        # Optimistic
        cls.crossovered_budget_budgetoptimistic0 = cls.env['crossovered.budget'].create({
            'name': 'Budget %s: Optimistic' % (datetime.now().year + 1),
            'date_from': str(datetime.now().year+1)+'-01-01',
            'date_to': str(datetime.now().year+1)+'-12-31',
            'state': 'draft',
            'user_id': cls.env.ref('base.user_admin').id,
            'crossovered_budget_line': [
                (0, 0, {
                    'date_from': str(datetime.now().year+1)+'-01-01',
                    'date_to': str(datetime.now().year+1)+'-12-31',
                    'planned_amount': -35000,
                    'analytic_account_id': cls.analytic_administratif.id,
                }), (0, 0, {
                    'date_from': str(datetime.now().year+1)+'-01-01',
                    'date_to': str(datetime.now().year+1)+'-01-31',
                    'planned_amount': 10000,
                    'analytic_account_id': cls.analytic_agrolait.id,
                }), (0, 0, {
                    'date_from': str(datetime.now().year+1)+'-02-01',
                    'date_to': str(datetime.now().year+1)+'-02-28',
                    'planned_amount': 10000,
                    'analytic_account_id': cls.analytic_agrolait.id,
                }), (0, 0, {
                    'date_from': str(datetime.now().year+1)+'-03-01',
                    'date_to': str(datetime.now().year+1)+'-03-31',
                    'planned_amount': 12000,
                    'analytic_account_id': cls.analytic_agrolait.id,
                }), (0, 0, {
                    'date_from': str(datetime.now().year+1)+'-04-01',
                    'date_to': str(datetime.now().year+1)+'-04-30',
                    'planned_amount': 15000,
                    'analytic_account_id': cls.analytic_agrolait.id,
                }), (0, 0, {
                    'date_from': str(datetime.now().year+1)+'-05-01',
                    'date_to': str(datetime.now().year+1)+'-05-31',
                    'planned_amount': 15000,
                    'analytic_account_id': cls.analytic_agrolait.id,
                }), (0, 0, {
                    'date_from': str(datetime.now().year+1)+'-06-01',
                    'date_to': str(datetime.now().year+1)+'-06-30',
                    'planned_amount': 15000,
                    'analytic_account_id': cls.analytic_agrolait.id,
                }), (0, 0, {
                    'date_from': str(datetime.now().year+1)+'-07-01',
                    'date_to': str(datetime.now().year+1)+'-07-31',
                    'planned_amount': 13000,
                    'analytic_account_id': cls.analytic_agrolait.id,
                }), (0, 0, {
                    'date_from': str(datetime.now().year+1)+'-08-01',
                    'date_to': str(datetime.now().year+1)+'-08-31',
                    'planned_amount': 9000,
                    'analytic_account_id': cls.analytic_agrolait.id,
                }), (0, 0, {
                    'date_from': str(datetime.now().year+1)+'-09-01',
                    'date_to': str(datetime.now().year+1)+'-09-30',
                    'planned_amount': 8000,
                    'analytic_account_id': cls.analytic_agrolait.id,
                }), (0, 0, {
                    'date_from': str(datetime.now().year+1)+'-10-01',
                    'date_to': str(datetime.now().year+1)+'-10-31',
                    'planned_amount': 15000,
                    'analytic_account_id': cls.analytic_agrolait.id,
                }), (0, 0, {
                    'date_from': str(datetime.now().year+1)+'-11-01',
                    'date_to': str(datetime.now().year+1)+'-11-30',
                    'planned_amount': 15000,
                    'analytic_account_id': cls.analytic_agrolait.id,
                }), (0, 0, {
                    'date_from': str(datetime.now().year+1)+'-12-01',
                    'date_to': str(datetime.now().year+1)+'-12-31',
                    'planned_amount': 18000,
                    'analytic_account_id': cls.analytic_agrolait.id,
                })
            ]
        })

        # Optimistic
        cls.crossovered_budget_budgetpessimistic0 = cls.env['crossovered.budget'].create({
            'name': 'Budget %s: Pessimistic' % (datetime.now().year + 1),
            'date_from': str(datetime.now().year+1)+'-01-01',
            'date_to': str(datetime.now().year+1)+'-12-31',
            'state': 'draft',
            'user_id': cls.env.ref('base.user_admin').id,
            'crossovered_budget_line': [
                (0, 0, {
                    'date_from': str(datetime.now().year+1)+'-01-01',
                    'date_to': str(datetime.now().year+1)+'-12-31',
                    'planned_amount': -55000,
                    'analytic_account_id': cls.analytic_administratif.id,
                }), (0, 0, {
                    'date_from': str(datetime.now().year+1)+'-01-01',
                    'date_to': str(datetime.now().year+1)+'-01-31',
                    'planned_amount': 9000,
                    'analytic_account_id': cls.analytic_agrolait.id,
                }), (0, 0, {
                    'date_from': str(datetime.now().year+1)+'-02-01',
                    'date_to': str(datetime.now().year+1)+'-02-28',
                    'planned_amount': 8000,
                    'analytic_account_id': cls.analytic_agrolait.id,
                }), (0, 0, {
                    'date_from': str(datetime.now().year+1)+'-03-01',
                    'date_to': str(datetime.now().year+1)+'-03-31',
                    'planned_amount': 10000,
                    'analytic_account_id': cls.analytic_agrolait.id,
                }), (0, 0, {
                    'date_from': str(datetime.now().year+1)+'-04-01',
                    'date_to': str(datetime.now().year+1)+'-04-30',
                    'planned_amount': 14000,
                    'analytic_account_id': cls.analytic_agrolait.id,
                }), (0, 0, {
                    'date_from': str(datetime.now().year+1)+'-05-01',
                    'date_to': str(datetime.now().year+1)+'-05-31',
                    'planned_amount': 16000,
                    'analytic_account_id': cls.analytic_agrolait.id,
                }), (0, 0, {
                    'date_from': str(datetime.now().year+1)+'-06-01',
                    'date_to': str(datetime.now().year+1)+'-06-30',
                    'planned_amount': 13000,
                    'analytic_account_id': cls.analytic_agrolait.id,
                }), (0, 0, {
                    'date_from': str(datetime.now().year+1)+'-07-01',
                    'date_to': str(datetime.now().year+1)+'-07-31',
                    'planned_amount': 10000,
                    'analytic_account_id': cls.analytic_agrolait.id,
                }), (0, 0, {
                    'date_from': str(datetime.now().year+1)+'-08-01',
                    'date_to': str(datetime.now().year+1)+'-08-31',
                    'planned_amount': 8000,
                    'analytic_account_id': cls.analytic_agrolait.id,
                }), (0, 0, {
                    'date_from': str(datetime.now().year+1)+'-09-01',
                    'date_to': str(datetime.now().year+1)+'-09-30',
                    'planned_amount': 7000,
                    'analytic_account_id': cls.analytic_agrolait.id,
                }), (0, 0, {
                    'date_from': str(datetime.now().year+1)+'-10-01',
                    'date_to': str(datetime.now().year+1)+'-10-31',
                    'planned_amount': 12000,
                    'analytic_account_id': cls.analytic_agrolait.id,
                }), (0, 0, {
                    'date_from': str(datetime.now().year+1)+'-11-01',
                    'date_to': str(datetime.now().year+1)+'-11-30',
                    'planned_amount': 17000,
                    'analytic_account_id': cls.analytic_agrolait.id,
                }), (0, 0, {
                    'date_from': str(datetime.now().year+1)+'-12-01',
                    'date_to': str(datetime.now().year+1)+'-12-31',
                    'planned_amount': 17000,
                    'analytic_account_id': cls.analytic_agrolait.id,
                })
            ]
        })
