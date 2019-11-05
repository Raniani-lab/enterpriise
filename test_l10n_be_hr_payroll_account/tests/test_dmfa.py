# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import date
from odoo.tests import common
from odoo.addons.test_mail.tests.common import mail_new_test_user


class TestDMFA(common.TransactionCase):

    def test_dmfa(self):
        user = mail_new_test_user(self.env, login='blou', groups='hr_payroll.group_hr_payroll_manager,fleet.fleet_group_manager')

        belgian_company = self.env['res.company'].create({
            'name': 'My Belgian Company - TEST',
            'country_id': self.env.ref('base.be').id,
        })

        lap_address = self.env['res.partner'].create({
            'name': 'Laurie Poiret',
            'street': '58 rue des Wallons',
            'city': 'Louvain-la-Neuve',
            'zip': '1348',
            'country_id': self.env.ref("base.be").id,
            'phone': '+0032476543210',
            'email': 'laurie.poiret@example.com',
            'company_id': belgian_company.id,
        })

        lap = self.env['hr.employee'].create({
            'name': 'Laurie Poiret',
            # 'gender': 'female',
            'marital': 'single',
            'address_home_id': lap_address.id,
            # 'address_id': ref="hr_contract_salary.res_partner_laurie_poiret_work_address"/>,
            # 'emergency_contact': 'Marc Poiret',
            # 'emergency_phone': '+0032498765432',
            # 'birthday': '1991-07-28',
            # 'km_home_work': 75,
            # 'place_of_birth': 'Brussels',
            # 'country_of_birth': ref="base.be"/>,
            # 'certificate': 'master',
            # 'study_field': 'Civil Engineering',
            # 'study_school': 'Université Catholique de Louvain-la-Neuve',
            # 'parent_id': ref="hr_contract_salary.employee_max"/>,
            # 'country_id': ref="base.be",
            'resource_calendar_id': self.env.ref("resource.resource_calendar_std_38h").id,
            # 'identification_id': 91-07-28-458-83,
            # 'bank_account_id': ref="hr_contract_salary.res_partner_bank_account_laurie_poiret"/>,
            # 'image_1920': type="base64" file="hr_contract_salary/static/img/hr_employe_laurie_poiret.jpg"/>,
            'company_id': belgian_company.id,
            # 'user_id': ref="hr_contract_salary.user_laurie_poiret"/>,
            # ''
        })
        company = lap.company_id
        user.company_ids = [(4, company.id)]
        lap.address_id = lap.company_id.partner_id
        company.dmfa_employer_class = 456
        company.onss_registration_number = 45645
        company.onss_company_id = 45645
        self.env['l10n_be.dmfa.location.unit'].with_user(user).create({
            'company_id': lap.company_id.id,
            'code': 123,
            'partner_id': lap.address_id.id,
        })
        dmfa = self.env['l10n_be.dmfa'].with_user(user).create({
            'reference': 'TESTDMFA',
            'company_id': belgian_company.id
        })
        dmfa.generate_dmfa_report()
        self.assertFalse(dmfa.error_message)
        self.assertEqual(dmfa.validation_state, 'done')
