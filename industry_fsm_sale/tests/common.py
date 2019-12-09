# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details

from odoo.addons.account.tests.common import AccountTestCommon
from odoo.addons.industry_fsm.tests.common import TestFsmFlowCommon


class TestFsmFlowSaleCommon(TestFsmFlowCommon, AccountTestCommon):

    @classmethod
    def setUpClass(cls):
        super(TestFsmFlowSaleCommon, cls).setUpClass()

        cls.partner_1 = cls.env['res.partner'].create({'name': 'A Test Partner 1'})

        cls.task = cls.env['project.task'].with_context({'mail_create_nolog': True}).create({
            'name': 'Fsm task',
            'user_id': cls.project_user.id,
            'project_id': cls.fsm_project.id})
