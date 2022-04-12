# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import date
from dateutil.relativedelta import relativedelta

from .common import HelpdeskCommon


class TestHelpdeskRating(HelpdeskCommon):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.partner_1 = cls.env['res.partner'].create({
            'name': 'Valid Lelitre',
            'email': 'valid.lelitre@agrolait.com'})

        # Enable rating feature
        cls.test_team.write({'use_rating': True})

        HelpdeskTicket = cls.env['helpdesk.ticket'].with_context({'mail_create_nolog': True})
        cls.test_team_ticket1 = HelpdeskTicket.create({
            'name': 'Ticket 1',
            'team_id': cls.test_team.id,
            'user_id': cls.helpdesk_manager.id,
        })
        cls.test_team_ticket2 = HelpdeskTicket.create({
            'name': 'Ticket 2',
            'team_id': cls.test_team.id,
            'user_id': cls.helpdesk_user.id,
        })

    def test_helpdesk_dashboard(self):
        """ Test the rating stat displayed in the dashboard for the current user.

            Test Cases:
            ==========
            1) Generate some ratings on the current date.
            2) Call the `retrieve_dashboard` method in helpdesk team model to get
               data displayed in the dashboard.
            3) Check the rating values in the dashboard data.
        """
        default_rating_vals = {
            'res_model_id': self.env['ir.model']._get('helpdesk.ticket').id,
            'parent_res_model_id': self.env['ir.model']._get('helpdesk.team').id,
            'parent_res_id': self.test_team.id,
            'partner_id': self.partner_1.id,
            'consumed': True,
        }
        yesterday = date.today() - relativedelta(days=1)
        yesterday_str = f'{yesterday.year}-{yesterday.month}-{yesterday.day}'
        ratings = self.env['rating.rating'].create([
            {
                **default_rating_vals,
                'rating': 5,
                'rated_partner_id': self.helpdesk_user.partner_id.id,
                'res_id': self.test_team_ticket2.id,
            },
            {
                **default_rating_vals,
                'rating': 3,
                'rated_partner_id': self.helpdesk_manager.partner_id.id,
                'res_id': self.test_team_ticket1.id,
            },
        ])
        self.env.cr.execute("UPDATE rating_rating SET create_date=%s, write_date=%s WHERE id in %s", (yesterday_str, yesterday_str, tuple(ratings.ids)))
        ratings.invalidate_recordset(['create_date', 'write_date'])

        HelpdeskTeam = self.env['helpdesk.team']
        self.assertTrue(HelpdeskTeam.with_user(self.helpdesk_manager)._check_rating_feature_enabled(True))
        data = HelpdeskTeam.with_user(self.helpdesk_manager).retrieve_dashboard()
        self.assertEqual(data['today']['rating'], 0, 'The average rating of the Helpdesk Manager should be equal to 0 since no rating is done today.')
        self.assertEqual(data['7days']['rating'], 60, 'The average rating of the Helpdesk Manager should be equal to 3 / 5')

        self.assertTrue(HelpdeskTeam.with_user(self.helpdesk_user)._check_rating_feature_enabled(True))
        data = HelpdeskTeam.with_user(self.helpdesk_user).retrieve_dashboard()
        self.assertEqual(data['today']['rating'], 0, 'The average rating of the Helpdesk user should be equal to 0 since no rating is done today.')
        self.assertEqual(data['7days']['rating'], 100, 'The average rating should be equal to 5 / 5.')

        # create ratings for today
        ratings = self.env['rating.rating'].create([
            {
                **default_rating_vals,
                'rating': 1,
                'rated_partner_id': self.helpdesk_user.partner_id.id,
                'res_id': self.test_team_ticket2.id,
            },
            {
                **default_rating_vals,
                'rating': 5,
                'rated_partner_id': self.helpdesk_manager.partner_id.id,
                'res_id': self.test_team_ticket1.id,
            },
        ])
        ratings.invalidate_recordset()
        data = HelpdeskTeam.with_user(self.helpdesk_manager).retrieve_dashboard()
        self.assertEqual(data['today']['rating'], 100, 'The average rating of the Helpdesk Manager user should be equal to 5 / 5')
        self.assertEqual(data['7days']['rating'], 80, 'The average rating of the Helpdesk Manager user should be equal to 4 / 5')

        data = HelpdeskTeam.with_user(self.helpdesk_user).retrieve_dashboard()
        self.assertEqual(data['today']['rating'], 20, 'The average rating should be equal to 1 / 5.')
        self.assertEqual(data['7days']['rating'], 60, 'The average rating should be equal to 3 / 5.')
