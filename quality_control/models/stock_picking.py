# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo.exceptions import UserError


class StockPicking(models.Model):
    _inherit = "stock.picking"

    check_ids = fields.One2many('quality.check', 'picking_id', 'Checks')
    quality_check_todo = fields.Boolean('Pending checks', compute='_compute_check')
    quality_check_fail = fields.Boolean(compute='_compute_check')
    quality_alert_ids = fields.One2many('quality.alert', 'picking_id', 'Alerts')
    quality_alert_count = fields.Integer(compute='_compute_quality_alert_count')

    def _compute_check(self):
        for picking in self:
            todo = False
            fail = False
            for check in picking.check_ids:
                if check.quality_state == 'none':
                    todo = True
                elif check.quality_state == 'fail':
                    fail = True
                if fail and todo:
                    break
            picking.quality_check_fail = fail
            picking.quality_check_todo = todo

    def _compute_quality_alert_count(self):
        for picking in self:
            picking.quality_alert_count = len(picking.quality_alert_ids)

    def check_quality(self):
        self.ensure_one()
        checks = self.check_ids.filtered(lambda check: check.quality_state == 'none')
        if checks:
            action = self.env.ref('quality_control.quality_check_action_small').read()[0]
            action['context'] = self.env.context
            action['res_id'] = checks.ids[0]
            return action
        return False

    def _create_backorder(self):
        res = super(StockPicking, self)._create_backorder()
        if self.env.context.get('skip_check'):
            return res
        # Transfer the quality checks from the original picking to the backorder
        # note this will not apply to quality checks for partially completed move lines (quality_state!='none' at this point)
        for backorder in res:
            backorder.backorder_id.check_ids.filtered(lambda qc: qc.quality_state == 'none').write({
                'picking_id': backorder.id,
            })
        return res

    def _action_done(self):
        # Do the check before transferring
        product_to_check = self.mapped('move_line_ids').filtered(lambda x: x.qty_done != 0).mapped('product_id')
        if self.mapped('check_ids').filtered(lambda x: x.quality_state == 'none' and x.product_id in product_to_check):
            raise UserError(_('You still need to do the quality checks!'))
        return super(StockPicking, self)._action_done()

    def _pre_action_done_hook(self):
        res = super()._pre_action_done_hook()
        if res is True:
            pickings_to_check_quality = self._check_for_quality_checks()
            if pickings_to_check_quality:
                return pickings_to_check_quality[0].with_context(pickings_to_check_quality=pickings_to_check_quality.ids).check_quality()
        return res

    def _check_for_quality_checks(self):
        quality_pickings = self.env['stock.picking']
        for picking in self:
            product_to_check = picking.mapped('move_line_ids').filtered(lambda ml: ml.qty_done != 0).mapped('product_id')
            if picking.mapped('check_ids').filtered(lambda qc: qc.quality_state == 'none' and qc.product_id in product_to_check):
                quality_pickings |= picking
        return quality_pickings

    def action_cancel(self):
        res = super(StockPicking, self).action_cancel()
        self.sudo().mapped('check_ids').filtered(lambda x: x.quality_state == 'none').unlink()
        return res

    def button_quality_alert(self):
        self.ensure_one()
        action = self.env.ref('quality_control.quality_alert_action_check').read()[0]
        action['views'] = [(False, 'form')]
        action['context'] = {
            'default_product_id': self.product_id.id,
            'default_product_tmpl_id': self.product_id.product_tmpl_id.id,
            'default_picking_id': self.id,
        }
        return action

    def open_quality_alert_picking(self):
        self.ensure_one()
        action = self.env.ref('quality_control.quality_alert_action_check').read()[0]
        action['context'] = {
            'default_product_id': self.product_id.id,
            'default_product_tmpl_id': self.product_id.product_tmpl_id.id,
            'default_picking_id': self.id,
        }
        action['domain'] = [('id', 'in', self.quality_alert_ids.ids)]
        action['views'] = [(False, 'tree'),(False,'form')]
        if self.quality_alert_count == 1:
            action['views'] = [(False, 'form')]
            action['res_id'] = self.quality_alert_ids.id
        return action
