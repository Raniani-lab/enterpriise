# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.mrp_account.tests.test_mrp_account import TestMrpAccount
from odoo.tests.common import Form


class TestReportsCommon(TestMrpAccount):

    def test_mrp_cost_structure(self):
        """ Check that values of mrp_cost_structure are correctly calculated even when
        multi-company + multi-currency environment.
        """

        # create MO with component cost
        self.product_table_sheet.standard_price = 20.0
        self.product_table_leg.standard_price = 5.0
        self.product_bolt.standard_price = 1.0
        self.product_screw.standard_price = 2.0
        self.product_table_leg.tracking = 'none'
        self.product_table_sheet.tracking = 'none'

        bom = self.mrp_bom_desk.copy()
        production_table_form = Form(self.env['mrp.production'])
        production_table_form.product_id = self.dining_table
        production_table_form.bom_id = bom
        production_table_form.product_qty = 1
        production_table = production_table_form.save()

        production_table.action_confirm()
        mo_form = Form(production_table)
        mo_form.qty_producing = 1
        production_table = mo_form.save()

        production_table._post_inventory()
        production_table.button_mark_done()

        total_component_cost = sum(move.product_id.standard_price * move.quantity_done for move in production_table.move_raw_ids)

        report = self.env['report.mrp_account_enterprise.mrp_cost_structure']
        report_values = report._get_report_values(docids=production_table.id)['lines'][0]
        self.assertEqual(report_values['total_cost'], total_component_cost)

        # create another company w/ different currency + rate
        exchange_rate = 4
        currency_p = self.env['res.currency'].create({
            'name': 'DBL',
            'symbol': 'DD',
            'rounding': 0.01,
            'currency_unit_label': 'Doubloon'
        })
        company_p = self.env['res.company'].create({'name': 'Pirates R Us', 'currency_id': currency_p.id})
        self.env['res.currency.rate'].create({
            'name': '2010-01-01',
            'rate': exchange_rate,
            'currency_id': self.env.company.currency_id.id,
            'company_id': company_p.id,
        })

        user_p = self.env['res.users'].create({
            'name': 'pirate',
            'login': 'pirate',
            'groups_id': [(6, 0, [self.env.ref('base.group_user').id, self.env.ref('mrp.group_mrp_manager').id])],
            'company_id': company_p.id,
            'company_ids': [(6, 0, [company_p.id, self.env.company.id])]
        })

        report_values = report.with_user(user_p)._get_report_values(docids=production_table.id)['lines'][0]
        self.assertEqual(report_values['total_cost'], total_component_cost / exchange_rate)
