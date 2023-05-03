# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.knowledge.controllers.portal import KnowledgePortal


class KnowledgePortalWebsite(KnowledgePortal):

    def _prepare_knowledge_article_domain(self):
        return [('website_published', '=', False)]
