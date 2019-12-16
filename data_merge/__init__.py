# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from . import models

import logging
_logger = logging.getLogger(__name__)

def post_init(cr, registry):
    query = "SELECT COUNT(extname) FROM pg_extension WHERE extname=%s"
    exts = ('unaccent', )

    for ext in exts:
        cr.execute(query, (ext, ))
        if not cr.fetchone()[0]:
            _logger.warning('pg extension "%s" not loaded' % ext)
