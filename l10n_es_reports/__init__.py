# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from . import models
from . import wizard


def _setup_mod_sequences(env):
    """ Creates a distinct sequence for each existing company,
    for both mod 347 and mod 349 BOE export.
    """
    all_companies = env['res.company'].search([])
    all_companies._create_mod_boe_sequences()