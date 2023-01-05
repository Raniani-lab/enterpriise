# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models


# TODO: remove this override as soon as the knowledge form view stops defining
# an owl template. In the mean time, we must bypass the view validation which
# detects the use of forbidden owl directives in archs.
class View(models.Model):
    _inherit = 'ir.ui.view'

    def _validate_qweb_directive(self, node, attr, view_type):
        if (self.model == "knowledge.article" and self.type == "form"):
            return
        return super()._validate_qweb_directive(node, attr, view_type)
