# -*- coding: utf-8 -*-

from odoo.addons.documents.controllers.documents import ShareRoute

class SpreadsheetShareRoute(ShareRoute):

    @classmethod
    def _get_downloadable_documents(cls, documents):
        """
            override of documents to prevent the download
            of spreadsheets binary as they are not usable
        """
        return super()._get_downloadable_documents(documents.filtered(lambda doc: doc.mimetype != "application/o-spreadsheet"))
