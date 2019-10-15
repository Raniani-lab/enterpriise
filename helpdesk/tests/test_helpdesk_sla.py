# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from contextlib import contextmanager

from odoo import fields
from odoo.tests.common import SavepointCase


class HelpdeskCommon(SavepointCase):

    @classmethod
    def setUpClass(cls):
        super(HelpdeskCommon, cls).setUpClass()

        # we create a helpdesk user and a manager
        Users = cls.env['res.users'].with_context(tracking_disable=True)
        cls.main_company_id = cls.env.ref('base.main_company').id
        cls.helpdesk_manager = Users.create({
            'company_id': cls.main_company_id,
            'name': 'Helpdesk Manager',
            'login': 'hm',
            'email': 'hm@example.com',
            'groups_id': [(6, 0, [cls.env.ref('helpdesk.group_helpdesk_manager').id])]
        })
        cls.helpdesk_user = Users.create({
            'company_id': cls.main_company_id,
            'name': 'Helpdesk User',
            'login': 'hu',
            'email': 'hu@example.com',
            'groups_id': [(6, 0, [cls.env.ref('helpdesk.group_helpdesk_user').id])]
        })
        # the manager defines a team for our tests (the .sudo() at the end is to avoid potential uid problems)
        cls.test_team = cls.env['helpdesk.team'].with_user(cls.helpdesk_manager).create({
            'name': 'Test Team',
            'use_sla': True
        }).sudo()
        # He then defines its stages
        stage_as_manager = cls.env['helpdesk.stage'].with_user(cls.helpdesk_manager)
        cls.stage_new = stage_as_manager.create({
            'name': 'New',
            'sequence': 10,
            'team_ids': [(4, cls.test_team.id, 0)],
            'is_close': False,
        })
        cls.stage_progress = stage_as_manager.create({
            'name': 'In Progress',
            'sequence': 20,
            'team_ids': [(4, cls.test_team.id, 0)],
            'is_close': False,
        })
        cls.stage_done = stage_as_manager.create({
            'name': 'Done',
            'sequence': 30,
            'team_ids': [(4, cls.test_team.id, 0)],
            'is_close': True,
        })
        cls.stage_cancel = stage_as_manager.create({
            'name': 'Cancelled',
            'sequence': 40,
            'team_ids': [(4, cls.test_team.id, 0)],
            'is_close': True,
        })

        cls.tag_vip = cls.env['helpdesk.tag'].with_user(cls.helpdesk_manager).create({'name': 'VIP'})
        cls.tag_urgent = cls.env['helpdesk.tag'].with_user(cls.helpdesk_manager).create({'name': 'Urgent'})

        cls.sla = cls.env['helpdesk.sla'].create({
            'name': 'SLA',
            'team_id': cls.test_team.id,
            'time_days': 1,
            'time_hours': 24,
            'stage_id': cls.stage_progress.id,
        })
        # He also creates a ticket types for Question and Issue
        cls.type_question = cls.env['helpdesk.ticket.type'].with_user(cls.helpdesk_manager).create({
            'name': 'Question_test',
        }).sudo()
        cls.type_issue = cls.env['helpdesk.ticket.type'].with_user(cls.helpdesk_manager).create({
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

    def create_ticket(self, *arg, **kwargs):
        default_values = {
            'name': "Help me",
            'team_id': self.test_team.id,
            'tag_ids': [(4, self.tag_urgent.id)],
            'stage_id': self.stage_new.id,
        }
        if 'tag_ids' in kwargs:
            # from recordset to ORM command
            kwargs['tag_ids'] = [(6, False, [tag.id for tag in kwargs['tag_ids']])]
        values = dict(default_values, **kwargs)
        return self.env['helpdesk.ticket'].create(values)

    def test_sla_no_tag(self):
        """ SLA without tag should apply to all tickets """
        self.sla.tag_ids = [(5,)]
        ticket = self.create_ticket(tag_ids=self.tag_urgent)
        self.assertEqual(ticket.sla_status_ids.sla_id, self.sla, "SLA should have been applied")

    def test_sla_single_tag(self):
        self.sla.tag_ids = [(4, self.tag_urgent.id)]
        ticket = self.create_ticket(tag_ids=self.tag_urgent)
        self.assertEqual(ticket.sla_status_ids.sla_id, self.sla, "SLA should have been applied")

    def test_sla_multiple_tags(self):
        self.sla.tag_ids = [(6, False, (self.tag_urgent | self.tag_vip).ids)]
        ticket = self.create_ticket(tag_ids=self.tag_urgent)
        self.assertFalse(ticket.sla_status_ids, "SLA should not have been applied yet")
        ticket.tag_ids = [(4, self.tag_vip.id)]
        self.assertEqual(ticket.sla_status_ids.sla_id, self.sla, "SLA should have been applied")

    def test_sla_tag_and_ticket_type(self):
        self.sla.tag_ids = [(6, False, self.tag_urgent.ids)]
        self.sla.ticket_type_id = self.type_question
        ticket = self.create_ticket(tag_ids=self.tag_urgent)
        self.assertFalse(ticket.sla_status_ids, "SLA should not have been applied yet")
        ticket.ticket_type_id = self.type_question
        self.assertEqual(ticket.sla_status_ids.sla_id, self.sla, "SLA should have been applied")

    def test_sla_remove_tag(self):
        self.sla.tag_ids = [(6, False, (self.tag_urgent | self.tag_vip).ids)]
        ticket = self.create_ticket(tag_ids=self.tag_urgent | self.tag_vip)
        self.assertEqual(ticket.sla_status_ids.sla_id, self.sla, "SLA should have been applied")
        ticket.tag_ids = [(5,)]  # Remove all tags
        self.assertFalse(ticket.sla_status_ids, "SLA should no longer apply")
