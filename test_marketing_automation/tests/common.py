# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from unittest.mock import patch

from odoo.addons.marketing_automation_sms.tests.common import MarketingAutomationSMSCommon
from odoo.fields import Datetime


class TestMACommon(MarketingAutomationSMSCommon):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()

        cls.test_records = cls._create_marketauto_records(model='marketing.test.sms', count=2)

        cls.patcher = patch('odoo.addons.marketing_automation.models.marketing_campaign.Datetime', wraps=Datetime)
        cls.patcher2 = patch('odoo.addons.marketing_automation.models.marketing_activity.Datetime', wraps=Datetime)
        cls.patcher3 = patch('odoo.addons.marketing_automation.models.marketing_participant.Datetime', wraps=Datetime)
        cls.patcher4 = patch('odoo.addons.marketing_automation.models.marketing_trace.Datetime', wraps=Datetime)
        cls.patcher5 = patch('odoo.addons.marketing_automation_sms.models.marketing_activity.Datetime', wraps=Datetime)

        cls.mock_datetime = cls.startClassPatcher(cls.patcher)
        cls.mock_datetime2 = cls.startClassPatcher(cls.patcher2)
        cls.mock_datetime3 = cls.startClassPatcher(cls.patcher3)
        cls.mock_datetime4 = cls.startClassPatcher(cls.patcher4)
        cls.mock_datetime5 = cls.startClassPatcher(cls.patcher5)

    @classmethod
    def _set_mock_datetime_now(cls, datetime):
        cls.mock_datetime.now.return_value = datetime
        cls.mock_datetime2.now.return_value = datetime
        cls.mock_datetime3.now.return_value = datetime
        cls.mock_datetime4.now.return_value = datetime
        cls.mock_datetime5.now.return_value = datetime

    # ------------------------------------------------------------
    # RECORDS TOOLS
    # ------------------------------------------------------------

    @classmethod
    def _create_marketauto_records(cls, model='marketing.test.sms', count=1):
        """ Create records for marketing automation. Each batch consists in

          * 3 records with a valid partner w mobile and email;
          * 1 record without partner w email and mobile;
          * 1 record without partner, wo email and mobile
        """
        records = cls.env[model]
        for x in range(0, count):
            for inner_x in range(0, 5):
                current_idx = x * 5 + inner_x
                if inner_x < 3:
                    name = 'Customer_%02d' % (current_idx)
                    partner = cls.env['res.partner'].create({
                        'name': name,
                        'mobile': '045600%04d' % (current_idx),
                        'country_id': cls.env.ref('base.be').id,
                        'email': '"%s" <email_%02d@example.com>' % (name, current_idx),
                    })
                else:
                    partner = cls.env['res.partner']

                record_name = 'Test_%02d' % current_idx
                vals = {
                    'name': record_name,
                    'customer_id': partner.id,
                    'description': 'Linked to partner %s' % partner.name if partner else '',
                }
                if inner_x == 3:
                    vals['email_from'] = '"%s" <nopartner.email_%02d@example.com>' % (name, current_idx)
                    vals['mobile'] = '+3245600%04d' % (current_idx)

                records += records.create(vals)
        return records
