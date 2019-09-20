# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests.common import TransactionCase


class TestHrReferralBase(TransactionCase):

    def setUp(self):
        super(TestHrReferralBase, self).setUp()

        self.company_1 = self.env['res.company'].create({'name': 'Opoo'})
        self.company_2 = self.env['res.company'].create({'name': 'Otoo'})
        self.company_ids = [self.company_1.id, self.company_2.id]

        self.dep_rd = self.env['hr.department'].create({
            'name': 'Research and Development',
            'company_id': self.company_1.id
        })

        # I create a new user and employee "Richard"
        self.richard_user = self.env['res.users'].create({
            'name': 'Richard',
            'login': 'ric'
        })
        self.richard_emp = self.env['hr.employee'].create({
            'name': 'Richard',
            'gender': 'male',
            'birthday': '1984-05-01',
            'country_id': self.ref('base.be'),
            'department_id': self.dep_rd.id,
            'user_id': self.richard_user.id,
            'company_id': self.company_1.id,
        })

        self.richard_emp_2 = self.env['hr.employee'].create({
            'name': 'Richard',
            'user_id': self.richard_user.id,
            'company_id': self.company_2.id,
        })

        # I create a new user and employee "Steve"
        self.steve_user = self.env['res.users'].create({
            'name': 'Steve',
            'login': 'stv'
        })
        self.steve_emp = self.env['hr.employee'].create({
            'name': 'Steve',
            'gender': 'male',
            'birthday': '1965-05-08',
            'country_id': self.ref('base.be'),
            'department_id': self.dep_rd.id,
            'user_id': self.steve_user.id
        })

        self.user_without_employee = self.env['res.users'].create({
            'name': 'No Employee',
            'login': 'no'
        })

        self.job_dev = self.env['hr.job'].create({
            'name': 'Dev',
            'no_of_recruitment': '5',
            'department_id': self.dep_rd.id,
            'company_id': self.company_1.id,
        })

        self.mug_shop = self.env['hr.referral.reward'].create({
            'name': 'Mug',
            'description': 'Beautiful and usefull',
            'cost': '5',
            'company_id': self.company_1.id,
        })

        self.red_mug_shop = self.env['hr.referral.reward'].create({
            'name': 'Red Mug',
            'description': 'It\'s red',
            'cost': '10',
            'company_id': self.company_2.id,
        })

        self.mug_shop = self.mug_shop.with_user(self.richard_user.id)
