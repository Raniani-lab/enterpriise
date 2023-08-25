# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import werkzeug

from odoo import http
from odoo.http import request
from odoo.addons.knowledge.controllers.main import KnowledgeController
from odoo.osv import expression


class KnowledgeWebsiteController(KnowledgeController):

    _KNOWLEDGE_TREE_ARTICLES_LIMIT = 50

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

    def _redirect_to_public_view(self, article, hide_side_bar=False):
        show_sidebar = False if hide_side_bar else self._check_sidebar_display()
        return request.render('knowledge.knowledge_article_view_frontend', {
            'article': article,
            'readonly_mode': True,  # used to bypass access check (to speed up loading)
            'show_sidebar': show_sidebar
        })

    def _prepare_articles_tree_html_values(self, active_article_id, unfolded_articles_ids=False, unfolded_favorite_articles_ids=False):
        """ Prepares all the info needed to render the article tree view side panel in portal

        :param int active_article_id: used to highlight the given article_id in the template;
        :param unfolded_articles_ids: List of IDs used to display the children
          of the given article ids. Unfolded articles are saved into local storage.
          When reloading/opening the article page, previously unfolded articles
          nodes must be opened;
        :param unfolded_favorite_articles_ids: same as ``unfolded_articles_ids``
          but specific for 'Favorites' tree.
        """
        root_articles_ids = request.env['knowledge.article'].sudo().search(
            [("parent_id", "=", False)]
        ).ids

        favorites_sudo = request.env['knowledge.article.favorite'].sudo()
        if not request.env.user._is_public():
            favorites_sudo = favorites_sudo.search(
                [("user_id", "=", request.uid), ('is_article_active', '=', True)]
            )
            # Add favorite articles, which are root articles in the favorite tree
            root_articles_ids += favorites_sudo.article_id.ids

        active_article_ancestor_ids = []
        unfolded_ids = (unfolded_articles_ids or []) + (unfolded_favorite_articles_ids or [])

        # Add active article and its parents in list of unfolded articles
        active_article = request.env['knowledge.article'].sudo().browse(active_article_id)
        if active_article and active_article.parent_id:
            active_article_ancestor_ids = active_article._get_ancestor_ids()
            unfolded_ids += active_article_ancestor_ids

        all_visible_articles = request.env['knowledge.article'].get_visible_articles(root_articles_ids, unfolded_ids)
        root_articles = all_visible_articles.filtered(lambda article: not article.parent_id)

        shared_articles = values['root_articles'].filtered(lambda a: a.user_has_access)
        public_articles = (values['root_articles'] - shared_articles).filtered(lambda a: a.website_published and a.category == 'workspace')

        return {
            "active_article_id": active_article_id,
            "active_article_ancestor_ids": active_article_ancestor_ids,
            "articles_displayed_limit": self._KNOWLEDGE_TREE_ARTICLES_LIMIT,
            "articles_displayed_offset": 0,
            "all_visible_articles": all_visible_articles,
            "root_articles": root_articles,
            "unfolded_articles_ids": unfolded_ids,
            "unfolded_favorite_articles_ids": unfolded_favorite_articles_ids,
            "favorites_sudo": favorites_sudo,
            'shared_articles': shared_articles,
            'public_articles': public_articles,
        }

    @http.route('/knowledge/tree_panel/portal', type='json', auth='public')
    def get_tree_panel_portal(self, active_article_id=False, unfolded_articles_ids=False, unfolded_favorite_articles_ids=False):
        """ Frontend access for left panel. """
        template_values = self._prepare_articles_tree_html_values(
            active_article_id,
            unfolded_articles_ids=unfolded_articles_ids,
            unfolded_favorite_articles_ids=unfolded_favorite_articles_ids
        )
        return request.env['ir.qweb']._render('knowledge.knowledge_article_tree_frontend', template_values)

    @http.route('/knowledge/tree_panel/portal/search', type='json', auth='public')
    def get_tree_panel_portal_search(self, search_term, active_article_id=False):
        """ Frontend access for left panel when making a search.
            Renders articles based on search term and ordered alphabetically.

            The tree is completely flattened (no sections nor child articles) to avoid noise
            (unnecessary parents display when children are matching) and redondancy (duplicated articles
            because of the favorite tree).

            :param int active_article_id: used to highlight the given article_id in the template;
            :param string search_term: user search term to filter the articles on;
        """

        # Get all the visible articles based on the search term
        all_visible_articles = request.env['knowledge.article'].search(
            expression.AND([[('is_article_item', '=', False)], [('name', 'ilike', search_term)]]),
            order='name',
            limit=self._KNOWLEDGE_TREE_ARTICLES_LIMIT,
        )

        values = {
            "search_tree": True, # Display the flatenned tree instead of the basic tree with sections
            "active_article_id": active_article_id,
            "articles_displayed_limit": self._KNOWLEDGE_TREE_ARTICLES_LIMIT,
            'articles': all_visible_articles,
        }

        return request.env['ir.qweb']._render('knowledge.knowledge_article_tree_frontend', values)

    @http.route('/knowledge/tree_panel/load_more', type='json', auth='public', sitemap=False)
    def tree_panel_load_more(self, category, limit, offset, active_article_id=False, parent_id=False, **kwargs):
        """" Route called when loading more articles in a particular sub-tree.

        Fetching is done based either on a parent, either on root articles when no parent is
        given.
        "limit" and "offset" allow controlling the returned result size.

        In addition, if we receive an 'active_article_id', it is forcefully displayed even if not
        in the first 50 articles of its own subtree.
        (Subsequently, all his parents are also forcefully displayed).
        That allows the end-user to always see where he is situated within the articles hierarchy.

        See 'articles_template' template docstring for details. """

        if parent_id:
            parent_id = int(parent_id)
            articles_domain = [('parent_id', '=', parent_id)]
        else:
            # root articles
            articles_domain = self._get_load_more_roots_domain(**kwargs)

        offset = int(offset)
        limit = int(limit)
        articles = request.env['knowledge.article'].search(
            articles_domain,
            limit=limit + 1,
            offset=offset,
            order='sequence, id',
        )

        if len(articles) < limit:
            articles_left_count = len(articles)
        else:
            articles_left_count = request.env['knowledge.article'].search_count(articles_domain) - offset

        active_article_ancestor_ids = []
        unfolded_articles_ids = []
        force_show_active_article = False
        if articles and active_article_id and active_article_id not in articles.ids:
            active_article_with_ancestors = request.env['knowledge.article'].search(
                [('id', 'parent_of', active_article_id)]
            )
            active_article = active_article_with_ancestors.filtered(
                lambda article: article.id == active_article_id)
            active_article_ancestors = active_article_with_ancestors - active_article
            unfolded_articles_ids = active_article_ancestors.ids

            # we only care about articles our current hierarchy (base domain)
            # and that are "next" (based on sequence of last article retrieved)
            force_show_domain = expression.AND([
                articles_domain,
                [('sequence', '>', articles[-1].sequence)]
            ])
            force_show_active_article = active_article.filtered_domain(force_show_domain)
            active_article_ancestors = active_article_ancestors.filtered_domain(force_show_domain)
            active_article_ancestor_ids = active_article_ancestors.ids

            if active_article_ancestors and not any(
                    ancestor_id in articles.ids for ancestor_id in active_article_ancestors.ids):
                articles |= active_article_ancestors

        return request.env['ir.qweb']._render('knowledge.articles_template', {
            "active_article_id": active_article_id,
            "active_article_ancestor_ids": active_article_ancestor_ids,
            "articles": articles,
            "articles_count": articles_left_count,
            "articles_displayed_limit": self._KNOWLEDGE_TREE_ARTICLES_LIMIT,
            "articles_displayed_offset": offset,
            "has_parent": bool(parent_id),
            "force_show_active_article": force_show_active_article,
            "unfolded_articles_ids": unfolded_articles_ids,
        })

    @http.route('/knowledge/home', type='http', auth='public', website=True, sitemap=False)
    def access_knowledge_home(self):
        return super().access_knowledge_home()

    @http.route('/knowledge/tree_panel/children', type='json', auth='public', website=True, sitemap=False)
    def get_tree_panel_children(self, parent_id):
        parent = request.env['knowledge.article'].search([('id', '=', parent_id)])
        if not parent:
            raise AccessError(_("This Article cannot be unfolded. Either you lost access to it or it has been deleted."))

        articles = parent.child_ids.filtered(
            lambda a: not a.is_article_item
        ).sorted("sequence") if parent.has_article_children else request.env['knowledge.article']
        return request.env['ir.qweb']._render('knowledge.articles_template', {
            'articles': articles,
            "articles_displayed_limit": self._KNOWLEDGE_TREE_ARTICLES_LIMIT,
            "articles_displayed_offset": 0,
            "has_parent": True,
        })

    @http.route('/knowledge/tree_panel/favorites', type='json', auth='user')
    def get_tree_panel_favorites(self, active_article_id=False, unfolded_favorite_articles_ids=False):
        unfolded_favorite_articles_ids = self._article_ids_exists(unfolded_favorite_articles_ids)

        favorites_sudo = request.env['knowledge.article.favorite'].sudo().search([
            ("user_id", "=", request.env.user.id), ('is_article_active', '=', True)
        ])

        all_visible_article_domains = expression.OR([
            [
                ('parent_id', 'child_of', favorites_sudo.article_id.ids),
                ('is_article_item', '=', False),
            ],
            [('id', 'in', favorites_sudo.article_id.ids)],
        ])

        all_visible_articles = request.env['knowledge.article'].search(all_visible_article_domains)

        return request.env['ir.qweb']._render('knowledge.knowledge_article_tree_favorites', {
            "favorites_sudo": favorites_sudo,
            "active_article_id": active_article_id,
            "all_visible_articles": all_visible_articles,
            "articles_displayed_limit": self._KNOWLEDGE_TREE_ARTICLES_LIMIT,
            "unfolded_favorite_articles_ids": unfolded_favorite_articles_ids,
        })

    def _get_load_more_roots_domain(self, **kwargs):
        """Only one section when website is not installed, so the only
        condition is that the articles are root articles.
        """
        return [('parent_id', '=', False)]
