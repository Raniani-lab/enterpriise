# -*- coding: utf-8 -*-

from . import controllers
from . import models

from odoo import api, SUPERUSER_ID

def _documents_project_post_init(cr, registry):
    env = api.Environment(cr, SUPERUSER_ID, {})
    domain = env['res.config.settings']._get_basic_project_domain()
    env['project.project'].search(domain)._create_missing_folders()
