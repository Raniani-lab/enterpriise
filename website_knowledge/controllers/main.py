# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import werkzeug

from odoo import http
from odoo.http import request
from odoo.addons.knowledge.controllers.main import KnowledgeController


class KnowledgeWebsiteController(KnowledgeController):

    # Override routes to display articles to public users
    @http.route('/knowledge/article/<int:article_id>', type='http', auth='public', website=True, sitemap=False)
    def redirect_to_article(self, **kwargs):
        if request.env.user._is_public():
            article = request.env['knowledge.article'].sudo().browse(kwargs['article_id'])
            if not article.exists():
                raise werkzeug.exceptions.NotFound()
            if not article.website_published:
                # public users can't access articles that are not published, let them login first
                return request.redirect('/web/login?redirect=/knowledge/article/%s' % kwargs['article_id'])
        return super().redirect_to_article(**kwargs)

    def _check_sidebar_display(self):
        """ With publish management, not all published articles should be
        displayed in the side panel.
        Only those should be available in the side panel:
          - Public articles = Published workspace article
          - Shared with you = Non-Published Workspace article you have access to
                              + shared articles you are member of

        Note: Here we need to split the check into 2 different requests as sudo
        is needed to access members, but sudo will grant access to workspace
        article user does not have access to.
        """
        accessible_workspace_roots = request.env["knowledge.article"].search_count(
            [("parent_id", "=", False), ("category", "=", "workspace")],
            limit=1,
        )
        if accessible_workspace_roots > 0:
            return True
        # Need sudo to access members
        displayable_shared_articles = request.env["knowledge.article"].sudo().search_count(
            [
                ("parent_id", "=", False),
                ("category", "=", "shared"),
                ("article_member_ids.partner_id", "=", request.env.user.partner_id.id),
                ("article_member_ids.permission", "!=", "none")
            ],
            limit=1,
        )
        return displayable_shared_articles > 0

    def _prepare_articles_tree_html_values(self, active_article_id=False, unfolded_articles_ids=False, unfolded_favorite_articles_ids=False):
        """ This override filters out the articles that should not be displayed
        in the tree panel once publish management is activated.
        "Shared articles" are articles which have the current user as member
        "Public articles" are workspace articles that are published
        """
        values = super()._prepare_articles_tree_html_values(
            active_article_id=active_article_id,
            unfolded_articles_ids=unfolded_articles_ids,
            unfolded_favorite_articles_ids=unfolded_favorite_articles_ids
        )

        shared_articles = values['root_articles'].filtered(lambda a: a.user_has_access)
        public_articles = (values['root_articles'] - shared_articles).filtered(lambda a: a.website_published and a.category == 'workspace')

        values.update({
            'shared_articles': shared_articles,
            'public_articles': public_articles,
        })
        return values

    @http.route('/knowledge/tree_panel/load_more', type='json', auth='public', sitemap=False)
    def tree_panel_load_more(self, category, limit, offset, active_article_id=False, parent_id=False):
        return super().tree_panel_load_more(category, limit, offset, active_article_id, parent_id)

    @http.route('/knowledge/home', type='http', auth='public', website=True, sitemap=False)
    def access_knowledge_home(self):
        return super().access_knowledge_home()

    @http.route('/knowledge/tree_panel/children', type='json', auth='public', website=True, sitemap=False)
    def get_tree_panel_children(self, parent_id):
        return super().get_tree_panel_children(parent_id)
