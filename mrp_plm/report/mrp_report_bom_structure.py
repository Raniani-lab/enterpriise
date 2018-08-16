# -*- coding: utf-8 -*-

from odoo import models


class ReportBomStructure(models.AbstractModel):
    _inherit = 'report.mrp.report_bom_structure'

    def _get_bom(self, bom_id=False, product_id=False, line_qty=False, line_id=False, level=False):
        res = super(ReportBomStructure, self)._get_bom(bom_id, product_id, line_qty, line_id, level)
        res['version'] = res['bom'] and res['bom'].version or ''
        res['ecos'] = self.env['mrp.eco'].search_count([('product_tmpl_id', '=', res['product'].product_tmpl_id.id), ('state', '!=', 'done')]) or ''
        return res

    def _get_bom_lines(self, bom, bom_quantity, product, line_id, level):
        components, total = super(ReportBomStructure, self)._get_bom_lines(bom, bom_quantity, product, line_id, level)
        for line in components:
            prod_id = self.env['product.product'].browse(line['prod_id'])
            child_bom = self.env['mrp.bom'].browse(line['child_bom'])
            line['version'] = child_bom and child_bom.version or ''
            line['ecos'] = self.env['mrp.eco'].search_count([('product_tmpl_id', '=', prod_id.product_tmpl_id.id), ('state', '!=', 'done')]) or ''
        return components, total
