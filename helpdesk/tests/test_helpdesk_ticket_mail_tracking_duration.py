# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.mail.tests.mail_tracking_duration_testing import TestMailTrackingDurationMixin


class TestHelpdeskTicketMailTrackingDuration(TestMailTrackingDurationMixin):

    @classmethod
    def setUpClass(cls):
        super().setUpClass('helpdesk.ticket')

    def test_helpdesk_ticket_mail_tracking_duration(self):
        self._test_record_duration_tracking()

    def test_helpdesk_ticket_mail_tracking_duration_batch(self):
        self._test_record_duration_tracking_batch()

    def test_helpdesk_ticket_queries_batch_mail_tracking_duration(self):
        self._test_queries_batch_duration_tracking()