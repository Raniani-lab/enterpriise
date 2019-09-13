# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging

from odoo import fields, models, _
from odoo.fields import Datetime
from odoo.exceptions import AccessError

_logger = logging.getLogger(__name__)


class MarketingActivity(models.Model):
    _inherit = ['marketing.activity']

    activity_type = fields.Selection(selection_add=[('sms', 'SMS')])
    sms_mailing_id = fields.Many2one(
        'mailing.mailing', string='SMS Mailing', related='mass_mailing_id',
        help='UX Field to choose an SMS mailing. Separate field to ease options / default / domain propagation.')

    def _execute_sms(self, traces):
        res_ids = [r for r in set(traces.mapped('res_id'))]

        mailing = self.mass_mailing_id.with_context(
            default_marketing_activity_id=self.ids[0],
        )

        # we only allow to continue if the user has sufficient rights, as a sudo() follows
        if not self.env.is_superuser() and not self.user_has_groups('marketing_automation.group_marketing_automation_user'):
            raise AccessError(_('To use this feature you should be an administrator or belong to the marketing automation group.'))
        try:
            mailing.sudo().action_send_sms(res_ids)
        except Exception as e:
            _logger.warning(_('Marketing Automation: activity <%s> encountered mass mailing issue %s'), self.id, str(e), exc_info=True)
            traces.write({
                'state': 'error',
                'schedule_date': Datetime.now(),
                'state_msg': _('Exception in SMS Marketing: %s') % str(e),
            })
        else:
            failed_stats = self.env['mailing.trace'].sudo().search([
                ('marketing_trace_id', 'in', traces.ids),
                '|', ('exception', '!=', False), ('ignored', '!=', False)])
            ignored_doc_ids = [stat.res_id for stat in failed_stats if stat.exception]
            error_doc_ids = [stat.res_id for stat in failed_stats if stat.ignored]

            processed_traces = traces
            ignored_traces = traces.filtered(lambda trace: trace.res_id in ignored_doc_ids)
            error_traces = traces.filtered(lambda trace: trace.res_id in error_doc_ids)

            if ignored_traces:
                ignored_traces.write({
                    'state': 'canceled',
                    'schedule_date': Datetime.now(),
                    'state_msg': _('Email ignored')
                })
                processed_traces = processed_traces - ignored_traces
            if error_traces:
                error_traces.write({
                    'state': 'error',
                    'schedule_date': Datetime.now(),
                    'state_msg': _('Email failed')
                })
                processed_traces = processed_traces - error_traces
            if processed_traces:
                processed_traces.write({
                    'state': 'processed',
                    'schedule_date': Datetime.now(),
                })
        return True
