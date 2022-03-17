# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.fields import Command
from odoo.tests.common import Form

from odoo.addons.helpdesk.tests.common import HelpdeskCommon
from odoo.addons.website_forum.tests.common import TestForumCommon

class TestHelpdeskForum(HelpdeskCommon, TestForumCommon):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.test_team.use_website_helpdesk_forum = True

        cls.ticket_name = 'Help Me'
        cls.ticket_description = 'Please Help'

        cls.ticket = cls.env['helpdesk.ticket'].create({
            'name': cls.ticket_name,
            'description': cls.ticket_description,
            'team_id': cls.test_team.id,
        })

    def test_share_ticket(self):
        self.assertTrue(self.ticket.can_share_forum, 'Ticket should be able to be shared on the forums.')

        form = Form(self.env['helpdesk.ticket.select.forum.wizard'].with_context({'active_id': self.ticket.id}))
        wizard = form.save()

        wizard.tag_ids = [Command.create({'name': 'tag_1', 'forum_id': self.forum.id}), Command.create({'name': 'tag_2', 'forum_id': self.forum.id})]
        post = wizard._create_forum_post()

        self.assertEqual(post.name, self.ticket_name, 'The created post should have the same name as the ticket.')
        self.assertEqual(post.plain_content, self.ticket_description, 'The created post should have the same description as the ticket.')
        self.assertEqual(post.ticket_id, self.ticket, 'The created post should point to the ticket.')
        self.assertEqual(len(post.tag_ids), 2, 'The created post should have the tags defined in the wizard.')
