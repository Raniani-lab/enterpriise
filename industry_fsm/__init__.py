# -*- coding: utf-8 -*-

from . import models
from . import wizard


def post_install_hook_force_timer(cr, registry):
    """ Set the company related setting use_timesheet_timer to true for all the companies
    """
    from odoo import api, SUPERUSER_ID

    env = api.Environment(cr, SUPERUSER_ID, {})
    for company in env['res.company'].search([]):
        company.write({
            'use_timesheet_timer': True,
        })
