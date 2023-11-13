# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.mail.tests.common import mail_new_test_user
from odoo.addons.mass_mailing.tests.common import MassMailCase, MassMailCommon


class MarketingAutomationCase(MassMailCase):

    # ------------------------------------------------------------
    # TOOLS AND ASSERTS
    # ------------------------------------------------------------

    def assertMarketAutoTraces(self, participants_info, activity, **trace_values):
        """ Check content of traces.

        :param participants_info: [{
            # participants
            'records': records,                           # records going through this activity
            'status': status,                             # marketing trace status (processed, ...) for all records
            'participants': participants record_set,      # optional: allow to check coherency of expected participants
            # trace
            'schedule_date': datetime or False,           # optional: check schedule_date on marketing trace
            'trace_status': status of mailing trace,      # if not set: check there is no mailing trace
            'trace_content': content of mail/sms          # content of sent mail / sms
            'trace_failure_type': failure_type of trace   # to check status update in case of failure
        }, {}, ... ]
        """
        all_records = self.env[activity.campaign_id.model_name]
        for info in participants_info:
            all_records += info['records']

        traces = self.env['marketing.trace'].search([
            ('activity_id', 'in', activity.ids),
        ])

        self.assertEqual(set(traces.mapped('res_id')), set(all_records.ids))
        for key, value in (trace_values or {}).items():
            self.assertEqual(set(traces.mapped(key)), set([value]))

        for info in participants_info:
            linked_traces = traces.filtered(lambda t: t.res_id in info['records'].ids)
            self.assertEqual(set(linked_traces.mapped('state')), set([info['status']]))
            self.assertEqual(set(linked_traces.mapped('res_id')), set(info['records'].ids))

            if 'schedule_date' in info:
                self.assertEqual(set(linked_traces.mapped('schedule_date')), set([info.get('schedule_date')]))

            if info.get('trace_status'):
                if activity.mass_mailing_id.mailing_type == 'mail':
                    self.assertMailTraces(
                        [{
                            'partner': self.env['res.partner'],  # TDE FIXME: make it generic and check why partner seems unset
                            'email': record.email_normalized,  # TDE FIXME: make it generic and check for aprtner
                            'failure_type': info.get('trace_failure_type', False),
                            'trace_status': info['trace_status'],
                            'record': record,
                         } for record in info['records']
                        ],
                        activity.mass_mailing_id,
                        info['records'],
                    )
            else:
                self.assertEqual(linked_traces.mailing_trace_ids, self.env['mailing.trace'])

            if info.get('participants'):
                self.assertEqual(traces.participant_id, info['participants'])

    # ------------------------------------------------------------
    # RECORDS TOOLS
    # ------------------------------------------------------------

    @classmethod
    def _create_mailing(cls, model, **mailing_values):
        vals = {
            'body_html': '<div>Hello {{object.name}}<br/>You rocks</div>',
            'mailing_model_id': cls.env['ir.model']._get_id(model),
            'mailing_type': 'mail',
            'name': 'SourceName',
            'subject': 'Test Subject',
            'use_in_marketing_automation': True,
        }
        vals.update(**mailing_values)
        return cls.env['mailing.mailing'].create(vals)

    @classmethod
    def _create_activity(cls, campaign, mailing=None, action=None, **act_values):
        vals = {
            'name': f'Activity {len(campaign.marketing_activity_ids) + 1}',
            'campaign_id': campaign.id,
        }
        if mailing:
            if mailing.mailing_type == 'mail':
                vals.update({
                    'mass_mailing_id': mailing.id,
                    'activity_type': 'email',
                })
            else:
                vals.update({
                    'mass_mailing_id': mailing.id,
                    'activity_type': 'sms',
                })
        elif action:
            vals.update({
                'server_action_id': action.id,
                'activity_type': 'action',
            })
        vals.update(**act_values)
        return cls.env['marketing.activity'].create(vals)


class MarketingAutomationCommon(MarketingAutomationCase, MassMailCommon):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()

        cls.user_marketing_automation = mail_new_test_user(
            cls.env,
            email='user.marketing.automation@test.example.com',
            groups='base.group_user,base.group_partner_manager,marketing_automation.group_marketing_automation_user',
            login='user_marketing_automation',
            name='Mounhir MarketAutoUser',
            signature='--\nM'
        )
