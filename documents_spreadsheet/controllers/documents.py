# -*- coding: utf-8 -*-

from odoo import _
from odoo.exceptions import AccessError
from odoo.addons.documents.controllers.documents import ShareRoute

class SpreadsheetShareRoute(ShareRoute):

    @classmethod
    def _get_downloadable_documents(cls, documents):
        """
            override of documents to prevent the download
            of spreadsheets binary as they are not usable
        """
        return super()._get_downloadable_documents(documents.filtered(lambda doc: doc.mimetype != "application/o-spreadsheet"))

    def _create_uploaded_documents(self, *args, **kwargs):
        documents = super()._create_uploaded_documents(*args, **kwargs)
        if any(doc.handler == "spreadsheet" for doc in documents):
            raise AccessError(_("You cannot upload spreadsheets in a shared folder"))
        return documents
