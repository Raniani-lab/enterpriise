# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, _


class SpreadsheetTemplate(models.Model):
    _name = "spreadsheet.template"
    _description = "Spreadsheet Template"
    _order = "sequence"

    name = fields.Char(required=True, translate=True)
    sequence = fields.Integer(default=100)
    data = fields.Binary(required=True)
    thumbnail = fields.Binary()

    def copy(self, default=None):
        self.ensure_one()
        chosen_name = default.get("name") if default else None
        new_name = chosen_name or _("%s (copy)", self.name)
        default = dict(default or {}, name=new_name)
        return super().copy(default)

    def fetch_template_data(self):
        """ Method called on template load
        Returns the following data:
        - the template name
        - its raw data
        - whether the user can edit the content of the template or not
        """
        self.ensure_one()
        can_write = self.check_access_rights("write", raise_exception=False) \
            and self.check_access_rule("write")
        return {
            "name": self.name,
            "data": self.data,
            "isReadonly": not can_write,
        }
