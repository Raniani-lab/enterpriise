# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from contextlib import contextmanager

from odoo.tests.common import TransactionCase
from odoo import fields


class HelpdeskTransactionCase(TransactionCase):

    def setUp(self):
        super(HelpdeskTransactionCase, self).setUp()

        # we create a helpdesk user and a manager
        self.main_company_id = self.env.ref('base.main_company').id
        self.helpdesk_manager = self.env['res.users'].create({
            'company_id': self.main_company_id,
            'name': 'Helpdesk Manager',
            'login': 'hm',
            'email': 'hm@example.com',
            'groups_id': [(6, 0, [self.env.ref('helpdesk.group_helpdesk_manager').id])]
        })
        self.helpdesk_user = self.env['res.users'].create({
            'company_id': self.main_company_id,
            'name': 'Helpdesk User',
            'login': 'hu',
            'email': 'hu@example.com',
            'groups_id': [(6, 0, [self.env.ref('helpdesk.group_helpdesk_user').id])]
        })
        # the manager defines a team for our tests (the .sudo() at the end is to avoid potential uid problems)
        self.test_team = self.env['helpdesk.team'].with_user(self.helpdesk_manager).create({'name': 'Test Team'}).sudo()
        # He then defines its stages
        stage_as_manager = self.env['helpdesk.stage'].with_user(self.helpdesk_manager)
        self.stage_new = stage_as_manager.create({
            'name': 'New',
            'sequence': 10,
            'team_ids': [(4, self.test_team.id, 0)],
            'is_close': False,
        }).sudo()
        self.stage_progress = stage_as_manager.create({
            'name': 'In Progress',
            'sequence': 20,
            'team_ids': [(4, self.test_team.id, 0)],
            'is_close': False,
        }).sudo()
        self.stage_done = stage_as_manager.create({
            'name': 'Done',
            'sequence': 30,
            'team_ids': [(4, self.test_team.id, 0)],
            'is_close': True,
        }).sudo()
        self.stage_cancel = stage_as_manager.create({
            'name': 'Cancelled',
            'sequence': 40,
            'team_ids': [(4, self.test_team.id, 0)],
            'is_close': True,
        }).sudo()

        # He also creates a ticket types for Question and Issue
        self.type_question = self.env['helpdesk.ticket.type'].with_user(self.helpdesk_manager).create({
            'name': 'Question_test',
        }).sudo()
        self.type_issue = self.env['helpdesk.ticket.type'].with_user(self.helpdesk_manager).create({
            'name': 'Issue_test',
        }).sudo()

    def _utils_set_create_date(self, records, date_str):
        """ This method is a hack in order to be able to define/redefine the create_date
            of the any recordset. This is done in SQL because ORM does not allow to write
            onto the create_date field.
            :param records: recordset of any odoo models
        """
        query = """
            UPDATE %s
            SET create_date = %%s
            WHERE id IN %%s
        """ % (records._table,)
        self.env.cr.execute(query, (date_str, tuple(records.ids)))

        records.invalidate_cache()

    @contextmanager
    def _ticket_patch_now(self, datetime_str):
        datetime_now_old = getattr(fields.Datetime, 'now')
        datetime_today_old = getattr(fields.Datetime, 'today')

        def new_now():
            return fields.Datetime.from_string(datetime_str)

        def new_today():
            return fields.Datetime.from_string(datetime_str).replace(hour=0, minute=0, second=0)

        try:
            setattr(fields.Datetime, 'now', new_now)
            setattr(fields.Datetime, 'today', new_today)

            yield
        finally:
            # back
            setattr(fields.Datetime, 'now', datetime_now_old)
            setattr(fields.Datetime, 'today', datetime_today_old)
