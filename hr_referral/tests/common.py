# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests.common import TransactionCase


class TestHrReferralBase(TransactionCase):

    def setUp(self):
        super(TestHrReferralBase, self).setUp()

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
            'department_id': self.ref('hr.dep_rd'),
            'user_id': self.richard_user.id
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
            'department_id': self.ref('hr.dep_rd'),
            'user_id': self.steve_user.id
        })

        self.job_dev = self.env['hr.job'].create({
            'name': 'Dev',
            'no_of_recruitment': '5',
            'department_id': self.ref('hr.dep_rd')
        })

        self.mug_shop = self.env['hr.referral.reward'].create({
            'name': 'Mug',
            'description': 'Beautiful and usefull',
            'cost': '5'
        })

        self.mug_shop = self.mug_shop.with_user(self.richard_user.id)
