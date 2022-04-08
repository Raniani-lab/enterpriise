# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import _, api, fields, models
from odoo.exceptions import UserError
from odoo.osv import expression


class ResCompany(models.Model):
    _inherit = "res.company"

    project_use_documents = fields.Boolean("Documents")
    project_documents_parent_folder = fields.Many2one('documents.folder', "Parent Workspace",
        domain="['|', ('company_id', '=', False), ('company_id', '=', id), '!', ('id', 'child_of', project_documents_template_folder)]")
    project_documents_template_folder = fields.Many2one('documents.folder', "Workspace Template",
        domain="['|', ('company_id', '=', False), ('company_id', '=', id), '!', ('id', 'parent_of', project_documents_parent_folder)]")

    @api.constrains('project_documents_parent_folder')
    def _check_parent_folder_company(self):
        if self.project_documents_parent_folder and self.project_documents_parent_folder.company_id and self.project_documents_parent_folder.company_id != self:
            raise UserError(_('The "%s" Parent Workspace should either be open to all companies or be in the "%s" company, for which the Documents feature is being configured.', self.project_documents_parent_folder.name, self.name))

    @api.constrains('project_documents_template_folder')
    def _check_template_folder_company(self):
        if self.project_documents_template_folder and self.project_documents_template_folder.company_id and self.project_documents_template_folder.company_id != self:
            raise UserError(_('The "%s" Workspace Template should either be open to all companies or be in the "%s" company, for which the Documents feature is being configured.', self.project_documents_template_folder.name, self.name))

    def _create_default_project_documents_folder(self):
        folders = self.env['documents.folder'].sudo().create([{
            'name': 'Projects',
            'sequence': 15,
            'company_id': company.id,
        } for company in self])

        for company, folder in zip(self, folders):
            company.project_documents_parent_folder = folder

        facets = self.env['documents.facet'].sudo().create([{
            'name': 'Status',
            'sequence': 10,
            'folder_id': folder.id,
        } for folder in folders])

        tags = self.env['documents.tag'].sudo().create([{
            'name': name,
            'sequence': sequence,
            'facet_id': facet.id,
        } for name, sequence in (
            ('Draft', 5),
            ('To Validate', 10),
            ('Validated', 15),
            ('Deprecated', 20),
        ) for facet in facets])

        tags_draft, tags_to_validate, tags_validated, tags_deprecated = (tags[i::4] for i in range(4))
        mail_documents_activity_to_validate = self.env.ref('documents.mail_documents_activity_data_tv')

        workflow_rules = self.env['documents.workflow.rule'].sudo().create([{
            'name': vals['name'],
            'sequence': vals['sequence'],
            'condition_type': 'domain',
            'domain': vals['domain'],
            'remove_activities': vals.get('remove_activities', False),
            'activity_option': vals.get('activity_option', False),
            'activity_type_id': vals.get('activity_type_id', False),
            'domain_folder_id': folder.id,
        } for i, folder in enumerate(folders) for vals in [{
            'name': 'Mark As Draft',
            'sequence': 10,
            'domain': f"['|', ('tag_ids', '=', False), ('tag_ids', 'in', [{tags_to_validate[i].id}, {tags_deprecated[i].id}])]",
            'remove_activities': True,
        }, {
            'name': 'Ask for Validation',
            'sequence': 15,
            'domain': f"[('tag_ids', 'in', [{tags_draft[i].id}])]",
            'activity_option': True,
            'activity_type_id': mail_documents_activity_to_validate.id,
        }, {
            'name': 'Validate',
            'sequence': 20,
            'domain': f"[('tag_ids', 'in', [{tags_draft[i].id}, {tags_to_validate[i].id}])]",
            'remove_activities': True,
        }, {
            'name': 'Deprecate',
            'sequence': 25,
            'domain': f"['|', ('tag_ids', '=', False), ('tag_ids', 'in', [{tags_to_validate[i].id}, {tags_validated[i].id}])]",
            'remove_activities': True,
        }]])

        self.env['documents.workflow.action'].sudo().create([{
            'action': 'replace',
            'workflow_rule_id': vals['workflow_rule_id'],
            'facet_id': vals['facet_id'],
            'tag_id': vals['tag_id'],
        } for i in range(len(folders)) for vals in [{
            'workflow_rule_id': workflow_rules[i + j].id,
            'facet_id': facets[i].id,
            'tag_id': tags[i + j].id,
        } for j in range(4)]])

    @api.model_create_multi
    def create(self, vals_list):
        companies = super().create(vals_list)
        companies._create_default_project_documents_folder()
        return companies

    def write(self, vals):
        res = super().write(vals)
        if 'project_use_documents' in vals:
            for company in self:
                projects = self.env["project.project"].search(
                    expression.AND([
                        self.env['res.config.settings']._get_basic_project_domain() if vals['project_use_documents'] else [],
                        [('company_id', '=', company.id)],
                    ])
                )
                projects.use_documents = vals['project_use_documents']
        return res
