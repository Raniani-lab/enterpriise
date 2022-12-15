# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from . import controllers
from . import models
from . import wizard


def _init_private_article_per_user(env):
    env['res.users'].search([('partner_share', '=', False)])._generate_tutorial_articles()
