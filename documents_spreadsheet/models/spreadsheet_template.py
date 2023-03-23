# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import json

from odoo import fields, models, _
from odoo.exceptions import AccessError

class SpreadsheetTemplate(models.Model):
    _name = "spreadsheet.template"
    _inherit = "spreadsheet.mixin"
    _description = "Spreadsheet Template"
    _order = "sequence"

    name = fields.Char(required=True, translate=True)
    sequence = fields.Integer(default=100)

    def copy(self, default=None):
        self.ensure_one()
        chosen_name = default.get("name") if default else None
        new_name = chosen_name or _("%s (copy)", self.name)
        default = dict(default or {}, name=new_name)
        return super().copy(default)

    def action_edit_template(self):
        self.ensure_one()
        return {
            "type": "ir.actions.client",
            "tag": "action_open_template",
            "params": {
                "spreadsheet_id": self.id,
            },
        }

    def action_create_spreadsheet(self, document_vals=None):
        if document_vals is None:
            document_vals = {}
        self.ensure_one()
        spreadsheet = self.env["documents.document"].create({
            "name": self.name,
            "mimetype": "application/o-spreadsheet",
            "handler": "spreadsheet",
            "spreadsheet_data": self.spreadsheet_data,
            **document_vals,
        })
        return {
            "type": "ir.actions.client",
            "tag": "action_open_spreadsheet",
            "params": {
                "spreadsheet_id": spreadsheet.id,
                "convert_from_template": True,
            },
        }

    def fetch_template_data(self):
        """ Method called on template load
        Returns the following data:
        - the template name
        - its raw data
        - whether the user can edit the content of the template or not
        """
        self.ensure_one()
        try:
            self.check_access_rights("write")
            self.check_access_rule("write")
            can_write = True
        except AccessError:
            can_write = False

        return {
            "name": self.name,
            "data": json.loads(self.spreadsheet_data),
            "isReadonly": not can_write,
        }
