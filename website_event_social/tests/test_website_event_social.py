# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from ast import literal_eval

from odoo.addons.website_event.tests.common import TestEventOnlineCommon


class TestTrackPush(TestEventOnlineCommon):
    def test_track_push(self):
        """" Test 'Send Push to Attendees' action and verify that it correctly
        targets all visitors that are registered to the event """

        registered_parent_visitor = self.env['website.visitor'].create({
            'name': 'Registered Parent',
            'push_subscription_ids': [(0, 0, {'push_token': 'AAAAA1'})],
            'event_registration_ids': [(0, 0, {
                'event_id': self.event_0.id
            })]
        })
        register_child_visitor = self.env['website.visitor'].create({
            'name': 'Registered Child',
            'push_subscription_ids': [(0, 0, {'push_token': 'AAAAA2'})],
        })
        register_child_visitor._link_to_visitor(registered_parent_visitor)

        registered_visitor = self.env['website.visitor'].create({
            'name': 'Registered Visitor',
            'push_subscription_ids': [(0, 0, {'push_token': 'BBBBB'})],
            'event_registration_ids': [(0, 0, {
                'event_id': self.event_0.id
            })]
        })

        # unregistered attendee that should not appear in results
        self.env['website.visitor'].create({
            'name': 'Unregistered Visitor',
            'push_subscription_ids': [(0, 0, {'push_token': 'CCCCC'})],
        })

        action = self.event_0.action_send_push()
        social_post = self.env['social.post'] \
            .with_context(action.get('context', {})) \
            .create({'message': 'Hello Attendees!'})

        targeted_visitors = self.env['website.visitor'].search(literal_eval(social_post.visitor_domain))
        # the result should show the 2 active visitors that are registered for the event
        self.assertEqual(targeted_visitors, registered_parent_visitor + registered_visitor)

        # however, we should have 3 push_tokens to push to
        # (the 1 from the registered_visitor and the 2 from the registered_parent_visitor)
        self.assertEqual(len(targeted_visitors.push_subscription_ids.mapped('push_token')), 3)
        self.assertEqual(
            targeted_visitors.push_subscription_ids,
            (registered_parent_visitor + registered_visitor + register_child_visitor).push_subscription_ids
        )
