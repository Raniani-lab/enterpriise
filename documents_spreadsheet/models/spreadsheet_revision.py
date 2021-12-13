# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import datetime

from odoo import api, fields, models


class SpreadsheetRevision(models.Model):
    _name = "spreadsheet.revision"
    _description = "Collaborative spreadsheet revision"

    active = fields.Boolean(default=True)
    document_id = fields.Many2one("documents.document", required=True, readonly=True)
    commands = fields.Char(required=True)
    revision_id = fields.Char(required=True)
    parent_revision_id = fields.Char(required=True)
    _sql_constraints = [
        ('parent_revision_unique', 'unique(parent_revision_id, document_id)', 'o-spreadsheet revision refused due to concurrency')
    ]

    @api.autovacuum
    def _gc_revisions(self):
        days = int(self.env["ir.config_parameter"].sudo().get_param(
            "documents_spreadsheets.revisions_limit_days",
            '60',
        ))
        timeout_ago = datetime.datetime.utcnow()-datetime.timedelta(days=days)
        domain = [("create_date", "<", timeout_ago), ("active", "=", False)]
        return self.search(domain).unlink()
