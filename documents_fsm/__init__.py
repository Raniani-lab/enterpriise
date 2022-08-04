# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from . import models

from odoo import api, SUPERUSER_ID

def _documents_fsm_post_init(cr, registry):
    env = api.Environment(cr, SUPERUSER_ID, {})
    fsm_projects = env['project.project'].search([('is_fsm', '=', 'True'), ('documents_folder_id', '!=', False)])
    fsm_projects.documents_folder_id.unlink()
