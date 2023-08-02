# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests.common import HttpCase
from odoo.tests.common import tagged


@tagged('post_install', '-at_install', 'knowledge_portal', 'knowledge_tour')
class TestKnowledgePublicSearch(HttpCase):
    """ Test public user search tree rendering. """

    def test_knowledge_search_flow_public(self):
        """This tour will check that the search bar tree rendering is properly updated"""

        # Create articles to populate published articles tree
        #
        # - My Article
        #       - Child Article
        # - Sibling Article

        # Create a cover for my article
        pixel = 'R0lGODlhAQABAIAAAP///wAAACwAAAAAAQABAAACAkQBADs='
        attachment = self.env['ir.attachment'].create({'name': 'pixel', 'datas': pixel, 'res_model': 'knowledge.cover', 'res_id': 0})
        cover = self.env['knowledge.cover'].create({'attachment_id': attachment.id})

        [my_article, _sibling] = self.env['knowledge.article'].create([{
            'name': 'My Article',
            'parent_id': False,
            'internal_permission': 'write',
            'website_published': True,
            'child_ids': [(0, 0, {
                'name': 'Child Article',
                'internal_permission': 'write',
                'website_published': True,
            })],
            'cover_image_id': cover.id,
        }, {
            'name': 'Sibling Article',
            'internal_permission': 'write',
            'website_published': True,
        }])

        self.start_tour('/knowledge/article/%s' % my_article.id, 'knowledge_public_search_tour')
