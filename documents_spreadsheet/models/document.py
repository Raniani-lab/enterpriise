# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, api
from odoo.tools import image_process

class Document(models.Model):
    _inherit = 'documents.document'

    handler = fields.Selection([('spreadsheet', 'Spreadsheet')], ondelete={'spreadsheet': 'cascade'})
    raw = fields.Binary(related='attachment_id.raw', readonly=False)
    # TODO extend the versioning system to use raw.

    @api.model_create_multi
    def create(self, vals_list):
        vals_list = self._assign_spreadsheet_default_folder(vals_list)
        for vals in vals_list:
            if vals.get('handler') == 'spreadsheet':
                if 'thumbnail' in vals:
                    vals['thumbnail'] = image_process(vals['thumbnail'], size=(80, 80), crop='center')
        documents = super().create(vals_list)
        documents._update_spreadsheet_contributors()
        return documents

    def write(self, vals):
        if 'raw' in vals:
            self._update_spreadsheet_contributors()
        return super().write(vals)

    @api.depends('checksum', 'handler')
    def _compute_thumbnail(self):
        # Spreadsheet thumbnails cannot be computed from their binary data.
        # They should be saved independently.
        spreadsheets = self.filtered(lambda d: d.handler == 'spreadsheet')
        super(Document, self - spreadsheets)._compute_thumbnail()

    def _assign_spreadsheet_default_folder(self, vals_list):
        """Make sure spreadsheet values have a `folder_id`. Assign the
        default spreadsheet folder if there is none.
        """
        default_folder = self.env.ref('documents_spreadsheet.documents_spreadsheet_folder', raise_if_not_found=False)
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
    def get_spreadsheets_to_display(self):
        Contrib = self.env["spreadsheet.contributor"]
        visible_docs = self.search([("handler", "=", "spreadsheet")])
        contribs = Contrib.search(
            [
                ("document_id", "in", visible_docs.ids),
                ("user_id", "=", self.env.user.id),
            ], order="last_update_date desc"
        )
        user_docs = contribs.document_id
        # keep only visible docs, but preserve order of contribs
        return (user_docs | visible_docs).read(["name"])
