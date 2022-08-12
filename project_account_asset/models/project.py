# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _lt

class Project(models.Model):
    _inherit = 'project.project'

    assets_count = fields.Integer('# Assets', compute='_compute_assets_count', groups='account.group_account_readonly')

    @api.depends('analytic_account_id')
    def _compute_assets_count(self):
        if not self.analytic_account_id:
            self.assets_count = 0
            return
        for project in self:
            assets = self.env['account.asset'].search([
                ('analytic_distribution_stored_char', '=ilike', f'%"{project.analytic_account_id.id}":%')
            ])
            project.assets_count = len(assets)

    # -------------------------------------
    # Actions
    # -------------------------------------

    def action_open_project_assets(self):
        assets = self.env['account.asset'].search([
                ('analytic_distribution_stored_char', '=ilike', f'%"{self.analytic_account_id.id}":%')
            ])
        action = self.env["ir.actions.actions"]._for_xml_id("account_asset.action_account_asset_form")
        action.update({
            'views': [[False, 'tree'], [False, 'form'], [False, 'kanban']],
            'context': {'default_analytic_distribution': {self.analytic_account_id.id: 100}, 'default_asset_type': 'purchase'},
            'domain': [('id', 'in', assets.ids)]
        })
        if(len(assets) == 1):
            action["views"] = [[False, 'form']]
            action["res_id"] = assets.id
        return action

    # ----------------------------
    #  Project Updates
    # ----------------------------

    def _get_stat_buttons(self):
        buttons = super(Project, self)._get_stat_buttons()
        if self.user_has_groups('account.group_account_readonly'):
            buttons.append({
                'icon': 'pencil-square-o',
                'text': _lt('Assets'),
                'number': self.assets_count,
                'action_type': 'object',
                'action': 'action_open_project_assets',
                'show': self.assets_count > 0,
                'sequence': 54,
            })
        return buttons
