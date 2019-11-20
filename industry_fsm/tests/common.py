# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details

from odoo.addons.account.tests.common import AccountTestCommon


class TestFsmFlowCommon(AccountTestCommon):

    @classmethod
    def setUpClass(cls):
        super(TestFsmFlowCommon, cls).setUpClass()

        cls.partner_1 = cls.env['res.partner'].create({'name': 'A Test Partner 1'})

        cls.project_user = cls.env['res.users'].create({
            'name': 'Armande Project_user',
            'login': 'Armande',
            'email': 'armande.project_user@example.com',
            'groups_id': [(6, 0, [cls.env.ref('project.group_project_user').id])]
        })

        cls.fsm_project = cls.env.ref('industry_fsm.fsm_project')

        cls.task = cls.env['project.task'].with_context({'mail_create_nolog': True}).create({
            'name': 'Fsm task',
            'user_id': cls.project_user.id,
            'project_id': cls.fsm_project.id})
