# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import random

from odoo import models
from odoo.tools import populate
from odoo.addons.base.models.ir_qweb_fields import nl2br
from odoo.addons.knowledge.populate import tools


class KnowledgeArticle(models.Model):
    _inherit = 'knowledge.article'
    _populate_dependencies = [
        'res.users',  # membership management
    ]
    # be careful that size only defines the amount of ROOT articles
    # there will be a lot more articles in the end, counting children
    # see underlying docstring in '_prepare_children_articles'
    # manual testing gives around 3000-4000 generated articles for "medium" size
    # (giving a bigger size also increases the amount of res.users we have for members config)
    # /!\ using "large" can take a very long time as we can't take advantage of the batching
    # because of parent / children relationship, everything is committed in one singular batch
    _populate_sizes = {
        'small': 5,  # will result in ~1.500
        'medium': 20,  # will result in ~5.000 records
        'large': 100,  # will result in ~27.000 records
    }

    def _populate(self, size):
        # create some dummy portal users as res.users populate only creates internal users
        self.env['res.users'].create([{
            'login': 'portal_user_knowledge_%i' % i,
            'email': 'portaluserknowledge%i@example.com' % i,
            'name': 'Portal User %i' % i,
            'groups_id': [
                (6, 0, [self.env.ref('base.group_portal').id]),
            ]
        } for i in range(self.env['res.users']._populate_sizes[size])])

        return super()._populate(size)

    def _populate_factories(self, depth=0):
        internal_partner_ids = self.env['res.users'].search([
            ('share', '=', False),
        ]).partner_id.ids
        shared_partner_ids = self.env['res.users'].search([
            ('share', '=', True),
        ]).partner_id.ids

        return self._populate_article_factories(depth, internal_partner_ids, shared_partner_ids)

    def _populate_article_factories(self, depth, internal_partner_ids, shared_partner_ids):
        if depth == 0:
            names = populate.iterate(tools._a_title_root)
        elif depth == 1:
            names = populate.iterate(tools._a_title_top_level)
        elif depth == 2:
            names = populate.iterate(tools._a_title_leaf)
        else:
            names = populate.randomize(tools._a_title_low_level, seed=random.randint(1, 100))

        return {
            ('name', names),
            ('body', populate.randomize([
                nl2br('%s' % tuple(tools.a_body_content_lorem_ipsum[:1])),
                nl2br('%s %s' % tuple(tools.a_body_content_lorem_ipsum[:2])),
                nl2br('%s %s %s' % tuple(tools.a_body_content_lorem_ipsum[:3])),
            ])),
            ('child_ids', populate.compute(lambda *args, **kwargs: self._prepare_children_articles(depth, internal_partner_ids, shared_partner_ids))),
            ('icon', populate.randomize(['🗒️', '🤖', '⭐', '🚀', '🎉', '☕', '🏆', '🛫', '💰', '📫'])),
            ('internal_permission', populate.compute(lambda *args, **kwargs: self._generate_internal_permission(depth))),
            ('is_locked', populate.randomize([True, False], [0.02, 0.98], seed=random.randint(1, 100))),
            ('full_width', populate.randomize([True, False], [0.2, 0.8], seed=random.randint(1, 100))),
            ('article_member_ids', populate.compute(lambda random, values, **kwargs: self._prepare_member_ids(depth, values, internal_partner_ids, shared_partner_ids))),
            ('is_locked', populate.randomize([True, False], [0.02, 0.98])),
            ('full_width', populate.randomize([True, False], [0.2, 0.8])),
            # TODO add article items / fill some properties fields
            # TODO add some favorites
        }

    def _prepare_children_articles(self, depth, internal_partner_ids, shared_partner_ids):
        """ As knowledge.article is a bit meaningless without a parent / children configuration,
        this methods aims to fill-up child_ids recursively.

        As the regular populate only allows to specify the 'total amount of records' we want to
        create, and it does not handle parent / children relationship, we apply a specific logic for
        children articles.

        The idea is to always have children for root articles and then lower the chances of generating
        children as you go into higher 'depth', with a maximum of 5 levels in total.
        The amount of children is chosen randomly between 2 and 10.

        The code that generates values re-uses the '_populate_factories' method and increases the depth
        every time we loop. """

        if depth > 4 or random.randint(1, depth + 1) != depth + 1:
            # higher depth means lower chance of having children articles
            # depth of 0 -> 100% (randint(1,1) needs to equal 1)
            # depth of 1 -> 50% (randint(1,2) needs to equal 2)
            # depth of 2 -> 33% (randint(1,2,3) needs to equal 3)
            # ...
            return []

        record_count = 0
        create_values = []
        field_generators = self._populate_article_factories(depth + 1, internal_partner_ids, shared_partner_ids)

        generator = populate.chain_factories(field_generators, self._name)
        for _i in range(random.randint(2, 10)):
            values = next(generator)
            values.pop('__complete')
            create_values.append((0, 0, values))
            record_count += 1

        return create_values

    def _generate_internal_permission(self, depth):
        if depth != 0:
            # we keep it simple and only set custom internal permission to root articles
            return False

        category = random.choices(['workspace', 'private'], weights=[0.9, 0.1], k=1)[0]
        if category == 'private':
            # private articles should be 'none' and handled at members level
            return 'none'

        # 80% will be write, 20% read
        return random.choices(['write', 'read'], weights=[0.8, 0.2], k=1)[0]

    def _prepare_member_ids(self, depth, values, internal_partner_ids, shared_partner_ids):
        private_member_values = []

        admin_partner_id = self.env.ref('base.user_admin').partner_id.id
        if values.get('internal_permission') == 'none':
            # private article -> keep it simple and assume that people will test with admin user
            # there will be one auto-generated private article for every user anyway (so size is already big)
            private_member_values = [(0, 0, {
                'partner_id': admin_partner_id,
                'permission': 'write'
            })]

        # we tweak the end range, so that the deeper you go, the less chance you have of having
        # members configuration
        randint = random.randint(1, (depth + 1) * 10)
        if randint > 4 and values.get('internal_permission') == 'write':
            # 60% base chance of not having member configuration
            # unless we don't have a 'write' internal permission, in which case we need members
            return private_member_values

        internal_partner_ids = random.sample(internal_partner_ids, k=min(random.randint(2, 10), len(internal_partner_ids)))
        members_values = []
        for partner_id in internal_partner_ids:
            if partner_id == admin_partner_id and private_member_values:
                continue  # avoid duplicate member

            # force one write members, otherwise 70% of write, 25% read, 5% none
            permission = 'write' if partner_id == internal_partner_ids[0] else random.choices(
                ['write', 'read', 'none'], weights=[70, 25, 5], k=1
            )[0]

            members_values.append({
                'partner_id': partner_id,
                'permission': permission
            })

        internal_member_ids = [
            (0, 0, member_values)
            for member_values in members_values
        ]

        if randint > 2 or values.get('internal_permission') == 'read':
            # 20% base chance of having only internal members
            return private_member_values + internal_member_ids

        # 10% base chance of having only external members
        shared_partner_ids = random.sample(shared_partner_ids, k=min(random.randint(2, 10), len(shared_partner_ids)))
        members_values = []
        for partner_id in shared_partner_ids:
            # 90% of write
            members_values.append({
                'partner_id': partner_id,
                'permission': random.choices(['read', 'none'], weights=[0.9, 0.1], k=1)[0]
            })

        shared_member_ids = [
            (0, 0, member_values)
            for member_values in members_values
        ]

        if randint == 2 and values.get('internal_permission') == 'write':
            # 10% base chance of having only external members (only for write internal permission)
            return shared_member_ids

        # 10% chance to have a mix of both
        return private_member_values + internal_member_ids + shared_member_ids
