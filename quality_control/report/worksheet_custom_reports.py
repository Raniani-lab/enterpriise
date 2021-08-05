# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import base64
from odoo import api, models
from odoo.tools import image_process
from odoo.addons.web.controllers.main import Binary


class QualityCustomReport(models.AbstractModel):
    _name = 'report.quality_control.quality_worksheet'
    _description = 'Quality Worksheet Report'

    @api.model
    def _get_report_values(self, docids, data=None):
        def resize_picture(b64source):
            if not b64source:
                b64source = base64.b64encode(Binary.placeholder())
            return image_process(b64source, size=(750, 750))

        docs = self.env['quality.check'].browse(docids).sudo()

        return {
            'doc_ids': docids,
            'doc_model': 'quality.check',
            'docs': docs,
            'resize_picture': resize_picture
        }

class QualityCustomInternalReport(models.AbstractModel):
    _name = 'report.quality_control.quality_worksheet_internal'
    _description = 'Quality Worksheet Internal Report'
    _inherit = 'report.quality_control.quality_worksheet'
