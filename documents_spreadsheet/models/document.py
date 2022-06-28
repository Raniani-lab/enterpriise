# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import base64

from odoo import fields, models, api
from odoo.osv import expression
from odoo.tools import image_process


class Document(models.Model):
    _name = "documents.document"
    _inherit = ["documents.document", "spreadsheet.collaborative.mixin"]

    handler = fields.Selection(
        [("spreadsheet", "Spreadsheet")], ondelete={"spreadsheet": "cascade"}
    )
    raw = fields.Binary(related="attachment_id.raw", readonly=False)

    @api.model_create_multi
    def create(self, vals_list):
        vals_list = self._assign_spreadsheet_default_folder(vals_list)
        vals_list = self._resize_spreadsheet_thumbnails(vals_list)
        documents = super().create(vals_list)
        documents._update_spreadsheet_contributors()
        return documents

    def write(self, vals):
        if 'mimetype' in vals and 'handler' not in vals:
            vals['handler'] = 'spreadsheet' if vals['mimetype'] == 'application/o-spreadsheet' else False
        if 'raw' in vals:
            self._update_spreadsheet_contributors()
        if all(document.handler == 'spreadsheet' for document in self):
            vals = self._resize_thumbnail_value(vals)
        return super().write(vals)

    def join_spreadsheet_session(self):
        data = super().join_spreadsheet_session()
        return dict(data, is_favorited=self.is_favorited)

    @api.depends("checksum", "handler")
    def _compute_thumbnail(self):
        # Spreadsheet thumbnails cannot be computed from their binary data.
        # They should be saved independently.
        spreadsheets = self.filtered(lambda d: d.handler == "spreadsheet")
        super(Document, self - spreadsheets)._compute_thumbnail()

    def _resize_thumbnail_value(self, vals):
        if 'thumbnail' in vals:
            return dict(
                vals,
                thumbnail=base64.b64encode(image_process(base64.b64decode(vals['thumbnail'] or ''), size=(750, 750), crop='center')),
            )
        return vals

    def _resize_spreadsheet_thumbnails(self, vals_list):
        return [
            (
                self._resize_thumbnail_value(vals)
                if vals.get('handler') == 'spreadsheet'
                else vals
            )
            for vals in vals_list
        ]

    def _assign_spreadsheet_default_folder(self, vals_list):
        """Make sure spreadsheet values have a `folder_id`. Assign the
        default spreadsheet folder if there is none.
        """
        # Use the current company's spreadsheet workspace, since `company_id` on `documents.document` is a related field
        # on `folder_id` we do not need to check vals_list for different companies.
        default_folder = self.env.company.documents_spreadsheet_folder_id
        if not default_folder:
            default_folder = self.env['documents.folder'].search([], limit=1, order="sequence asc")
        return [
            (
                dict(vals, folder_id=vals.get('folder_id', default_folder.id))
                if vals.get('handler') == 'spreadsheet'
                else vals
            )
            for vals in vals_list
        ]

    def _update_spreadsheet_contributors(self):
        """Add the current user to the spreadsheet contributors.
        """
        for document in self:
            if document.handler == 'spreadsheet':
                self.env['spreadsheet.contributor']._update(self.env.user, document)

    @api.model
    def get_spreadsheets_to_display(self, domain, offset=0, limit=None):
        """
        Get all the spreadsheets, with the spreadsheet that the user has recently
        opened at first.
        """
        Contrib = self.env["spreadsheet.contributor"]
        visible_docs = self.search(expression.AND([domain, [("handler", "=", "spreadsheet")]]))
        contribs = Contrib.search(
            [
                ("document_id", "in", visible_docs.ids),
                ("user_id", "=", self.env.user.id),
            ],
            order="last_update_date desc",
        )
        user_docs = contribs.document_id
        # Intersection is used to apply the `domain` to `user_doc`, the union is
        # here to keep only the visible docs, but with the order of contribs.
        docs = ((user_docs & visible_docs) | visible_docs)
        if (limit):
            docs = docs[offset:offset+limit]
        else:
            docs = docs[offset:]
        return docs.read(["name", "thumbnail"])
