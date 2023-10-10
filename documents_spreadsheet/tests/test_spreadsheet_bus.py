# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from .common import SpreadsheetTestCommon
from odoo.tests.common import new_test_user
from odoo.addons.bus.models.bus import channel_with_db
from odoo.addons.mail.tests.common import MailCase


class TestSpreadsheetBus(SpreadsheetTestCommon, MailCase):

    def poll(self, *channels, last=0):
        # Simulates what's done when subscribing to a bus channel.
        # MockRequest would be usefull, but it's currently only defined
        # with website
        channels = [
            channel_with_db(self.env.registry.db_name, c)
            for c in self.env["ir.websocket"]._add_spreadsheet_collaborative_bus_channels(channels)
        ]
        return self.env["bus.bus"]._poll(channels, last)

    def poll_spreadsheet(self, spreadsheet_id, share_id=None, access_token=None):
        if share_id and access_token:
            external_channel = f"spreadsheet_collaborative_session:documents.document:{spreadsheet_id}:{share_id}:{access_token}"
        else:
            external_channel = f"spreadsheet_collaborative_session:documents.document:{spreadsheet_id}"
        notifs = self.poll(external_channel)
        return [
            m["message"]["payload"]
            for m in notifs
        ]

    def test_simple_bus_message_still_works(self):
        self.env["bus.bus"]._sendone("a-channel", "message-type", "a message")
        message = self.poll("a-channel")
        self.assertEqual(message[0]["message"]["payload"], "a message")

    def test_active_spreadsheet(self):
        spreadsheet = self.create_spreadsheet()
        spreadsheet.join_spreadsheet_session()
        commands = self.new_revision_data(spreadsheet)
        spreadsheet.dispatch_spreadsheet_message(commands)
        self.assertEqual(
            self.poll_spreadsheet(spreadsheet.id),
            [commands],
            "It should have received the revision"
        )

    def test_archived_active_spreadsheet(self):
        spreadsheet = self.create_spreadsheet()
        spreadsheet.active = False
        spreadsheet.join_spreadsheet_session()
        commands = self.new_revision_data(spreadsheet)
        spreadsheet.dispatch_spreadsheet_message(commands)
        self.assertEqual(
            self.poll_spreadsheet(spreadsheet.id),
            [commands],
            "It should have received the revision"
        )

    def test_inexistent_spreadsheet(self):
        spreadsheet = self.env["documents.document"].browse(9999999)
        self.assertFalse(spreadsheet.exists())
        self.assertEqual(
            self.poll_spreadsheet(spreadsheet.id),
            [],
            "It should have ignored the wrong spreadsheet"
        )

    def test_wrong_active_spreadsheet(self):
        self.assertEqual(
            self.poll_spreadsheet("a-wrong-spreadsheet-id"),
            [],
            "It should have ignored the wrong spreadsheet"
        )

    def test_snapshot(self):
        spreadsheet = self.create_spreadsheet()
        current_revision_id = spreadsheet.server_revision_id
        self.snapshot(
            spreadsheet,
            current_revision_id, "snapshot-revision-id", {"sheets": []},
        )
        self.assertEqual(
            self.poll_spreadsheet(spreadsheet.id),
            [{
                "type": "SNAPSHOT_CREATED",
                "id": spreadsheet.id,
                "serverRevisionId": current_revision_id,
                "nextRevisionId": "snapshot-revision-id",
            }],
            "It should have notified the snapshot"
        )

    def test_poll_access(self):
        group = self.env["res.groups"].create({"name": "test group"})
        spreadsheet = self.create_spreadsheet()
        spreadsheet.join_spreadsheet_session()
        commands = self.new_revision_data(spreadsheet)
        spreadsheet.dispatch_spreadsheet_message(commands)
        spreadsheet.folder_id.read_group_ids = group
        raoul = new_test_user(self.env, login="Raoul")
        new_test_user(self.env, login="John")
        raoul.groups_id |= group
        with self.with_user("John"):
            self.assertEqual(
                self.poll_spreadsheet(spreadsheet.id),
                [],
                "He should not be able to poll the spreadsheet"
            )
        with self.with_user("Raoul"):
            self.assertEqual(
                self.poll_spreadsheet(spreadsheet.id),
                [commands],
                "He should be able to poll the spreadsheet"
            )

    def test_read_shared_spreadsheet(self):
        spreadsheet = self.create_spreadsheet()
        share = self.share_spreadsheet(spreadsheet)
        new_test_user(self.env, login="raoul", groups="base.group_public")
        revision = self.new_revision_data(spreadsheet)
        spreadsheet.dispatch_spreadsheet_message(revision)

        # without token
        with self.with_user("raoul"):
            self.assertEqual(
                self.poll_spreadsheet(spreadsheet.id),
                [],
                "He should not have received the revision"
            )
        # with wrong token
        with self.with_user("raoul"):
            self.assertEqual(
                self.poll_spreadsheet(spreadsheet.id, share.id, "wrong-token"),
                [],
                "He should not have received the revision"
            )
        # with token
        with self.with_user("raoul"):
            self.assertEqual(
                self.poll_spreadsheet(spreadsheet.id, share.id, share.access_token),
                [revision],
                "He should have received the revision"
            )
