# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    project_use_documents = fields.Boolean(related='company_id.project_use_documents', readonly=False, string="Documents")
    project_documents_parent_folder = fields.Many2one('documents.folder', related='company_id.project_documents_parent_folder', readonly=False,
        domain="['|', ('company_id', '=', False), ('company_id', '=', company_id), '!', ('id', 'child_of', project_documents_template_folder)]",
        string="Parent Workspace", help="If set, automatically created project workspaces will be children of this workspace.")
    project_documents_template_folder = fields.Many2one('documents.folder', related='company_id.project_documents_template_folder', readonly=False,
        domain="['|', ('company_id', '=', False), ('company_id', '=', company_id), '!', ('id', 'parent_of', project_documents_parent_folder)]",
        string="Workspace Template", help="If set, automatically created project workspaces will have the same actions, tags, and children workspaces as this template.")

    @api.onchange('project_documents_template_folder')
    def _onchange_project_documents_template_folder(self):
        if not self.project_documents_parent_folder or not self.project_documents_template_folder:
            return
        if self.project_documents_parent_folder in self.env['documents.folder'].search([('id', 'child_of', self.project_documents_template_folder.id)]):
            self.project_documents_parent_folder = False

    @api.onchange('project_documents_parent_folder')
    def _onchange_project_documents_parent_folder(self):
        if not self.project_documents_parent_folder or not self.project_documents_template_folder:
            return
        if self.project_documents_template_folder in self.env['documents.folder'].search([('id', 'parent_of', self.project_documents_parent_folder.id)]):
            self.project_documents_template_folder = False
