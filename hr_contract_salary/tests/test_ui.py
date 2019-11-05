# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import base64 
import time

import odoo.tests
from odoo.addons.test_mail.tests.common import mail_new_test_user
from odoo.modules.module import get_module_resource


@odoo.tests.tagged('-at_install', 'post_install')
class TestUi(odoo.tests.HttpCase):
    def test_ui(self):
        # no user available for belgian company so to set hr responsible change company of demo
        demo = mail_new_test_user(self.env, name="Laurie Poiret", login='be_demo', groups='base.group_user')
        pdf_path = get_module_resource('hr_contract_salary', 'static', 'src', 'demo', 'employee_contract.pdf')
        pdf_content = base64.b64encode(open(pdf_path, "rb").read())

        attachment = self.env['ir.attachment'].create({
            'type': 'binary',
            'datas': pdf_content,
            'name': 'test_employee_contract.pdf',
        })
        template = self.env['sign.template'].create({
            'attachment_id': attachment.id,
            'sign_item_ids': [(6, 0, [])],
        })

        self.env['sign.item'].create([
            {
                'type_id': self.env.ref('sign.sign_item_type_text').id,
                'name': 'employee_id.name',
                'required': True,
                'responsible_id': self.env.ref('sign.sign_item_role_employee').id,
                'page': 1,
                'posX': 0.273,
                'posY': 0.158,
                'template_id': template.id,
                'width': 0.150,
                'height': 0.015,
            }, {
                'type_id': self.env.ref('sign.sign_item_type_date').id,
                'name': False,
                'required': True,
                'responsible_id': self.env.ref('sign.sign_item_role_employee').id,
                'page': 1,
                'posX': 0.707,
                'posY': 0.158,
                'template_id': template.id,
                'width': 0.150,
                'height': 0.015,
            }, {
                'type_id': self.env.ref('sign.sign_item_type_text').id,
                'name': 'employee_id.address_home_id.city',
                'required': True,
                'responsible_id': self.env.ref('sign.sign_item_role_employee').id,
                'page': 1,
                'posX': 0.506,
                'posY': 0.184,
                'template_id': template.id,
                'width': 0.150,
                'height': 0.015,
            }, {
                'type_id': self.env.ref('sign.sign_item_type_text').id,
                'name': 'employee_id.address_home_id.country_id.name',
                'required': True,
                'responsible_id': self.env.ref('sign.sign_item_role_employee').id,
                'page': 1,
                'posX': 0.663,
                'posY': 0.184,
                'template_id': template.id,
                'width': 0.150,
                'height': 0.015,
            }, {
                'type_id': self.env.ref('sign.sign_item_type_text').id,
                'name': 'employee_id.address_home_id.street2',
                'required': True,
                'responsible_id': self.env.ref('sign.sign_item_role_employee').id,
                'page': 1,
                'posX': 0.349,
                'posY': 0.184,
                'template_id': template.id,
                'width': 0.150,
                'height': 0.015,
            }, {
                'type_id': self.env.ref('sign.sign_item_type_signature').id,
                'name': False,
                'required': True,
                'responsible_id': self.env.ref('hr_contract_sign.sign_item_role_job_responsible').id,
                'page': 2,
                'posX': 0.333,
                'posY': 0.575,
                'template_id': template.id,
                'width': 0.200,
                'height': 0.050,
            }, {
                'type_id': self.env.ref('sign.sign_item_type_signature').id,
                'name': False,
                'required': True,
                'responsible_id': self.env.ref('sign.sign_item_role_employee').id,
                'page': 2,
                'posX': 0.333,
                'posY': 0.665,
                'template_id': template.id,
                'width': 0.200,
                'height': 0.050,
            }, {
                'type_id': self.env.ref('sign.sign_item_type_date').id,
                'name': False,
                'required': True,
                'responsible_id': self.env.ref('sign.sign_item_role_employee').id,
                'page': 2,
                'posX': 0.665,
                'posY': 0.694,
                'template_id': template.id,
                'width': 0.150,
                'height': 0.015,
            }
        ])


        company_id = self.env['res.company'].create({
            'name': 'My Belgian Company - TEST',
            'country_id': self.env.ref('base.be').id,
        })
        partner_id = self.env['res.partner'].create({
            'name': 'Laurie Poiret',
            'street': '58 rue des Wallons',
            'city': 'Louvain-la-Neuve',
            'zip': '1348',
            'country_id': self.env.ref("base.be").id,
            'phone': '+0032476543210',
            'email': 'laurie.poiret@example.com',
            'company_id': company_id.id,
        })

        self.env['fleet.vehicle'].create({
            'model_id': self.env.ref("fleet.model_a3").id,
            'license_plate': '1-JFC-095',
            'acquisition_date': time.strftime('%Y-01-01'),
            'co2': 88,
            'driver_id': partner_id.id,
            'car_value': 38000,
            'company_id': company_id.id,
        })

        a_recv = self.env['account.account'].create({
            'code': 'X1012',
            'name': 'Debtors - (test)',
            'reconcile': True,
            'user_type_id': self.env.ref('account.data_account_type_receivable').id,
        })
        a_pay = self.env['account.account'].create({
            'code': 'X1111',
            'name': 'Creditors - (test)',
            'user_type_id': self.env.ref('account.data_account_type_payable').id,
            'reconcile': True,
        })
        self.env['ir.property'].create([{
            'name': 'property_account_receivable_id',
            'fields_id': self.env['ir.model.fields'].search([('model', '=', 'res.partner'), ('name', '=', 'property_account_receivable_id')], limit=1).id,
            'value': 'account.account,%s' % (a_recv.id),
            'company_id': company_id.id,
        }, {
            'name': 'property_account_payable_id',
            'fields_id': self.env['ir.model.fields'].search([('model', '=', 'res.partner'), ('name', '=', 'property_account_payable_id')], limit=1).id,
            'value': 'account.account,%s' % (a_pay.id),
            'company_id': company_id.id,
        }])

        self.env.ref('base.user_admin').write({'company_ids': [(4, company_id.id)], 'name': 'Mitchell Admin'})
        self.env.ref('base.user_admin').partner_id.write({'email': 'mitchell.stephen@example.com', 'name': 'Mitchell Admin'})
        # self.env.ref('base.user_admin').write({'company_ids': [(4, company_id.id)], 'email': 'test@example.com'})
        demo.write({'partner_id': partner_id, 'company_id': company_id.id, 'company_ids': [(4, company_id.id)]})
        demo.flush()
        self.start_tour("/", 'hr_contract_salary_tour', login='admin', timeout=100)
