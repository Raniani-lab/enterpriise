# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from . import models

from odoo import api, SUPERUSER_ID

def _documents_project_sign_post_init(cr, registry):
    env = api.Environment(cr, SUPERUSER_ID, {})
    env['res.company'].search([])._create_sign_workflow_data()
