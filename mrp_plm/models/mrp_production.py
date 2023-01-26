# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import api, fields, models


class MrpProduction(models.Model):
    _inherit = 'mrp.production'

    latest_bom_id = fields.Many2one('mrp.bom', compute="_compute_latest_bom_id")

    @api.depends('bom_id', 'bom_id.active')
    def _compute_latest_bom_id(self):
        self.latest_bom_id = False
        mo_ids_without_latest_bom = []
        # check if the bom has a new version
        for mo in self:
            if not mo.bom_id or not mo.id:  # Avoid MO who wasn't saved yet.
                continue
            if not mo.bom_id.active:
                mo.latest_bom_id = mo.bom_id._get_active_version()
            if not mo.latest_bom_id:
                mo_ids_without_latest_bom.append(mo.id)
        # Checks if the MO has some component move from an outdated BoM (can happen with exploded kit).
        mos_with_component_from_outdated_kit = self.search([
            ('id', 'in', mo_ids_without_latest_bom),
            ('move_raw_ids.bom_line_id.bom_id.active', '=', False)
        ])
        # For these MOs, we assign their current BoM as the latest one in the purpose to enable the
        # "Update BoM" action on these MOs, that way, the raw moves from a kit will be recreated
        # from the active version of their BoM.
        for mo in mos_with_component_from_outdated_kit:
            mo.latest_bom_id = mo.bom_id

    def action_update_bom(self):
        for production in self:
            if production.state != 'draft' or not production.latest_bom_id:
                continue
            latest_bom = production.latest_bom_id
            (production.move_finished_ids | production.move_raw_ids).unlink()
            production.workorder_ids.unlink()
            production.write({'bom_id': latest_bom.id})
