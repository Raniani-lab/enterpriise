# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import _, api, fields, models
from odoo.exceptions import UserError
from odoo.osv import expression


class DocumentFolder(models.Model):
    _inherit = 'documents.folder'

    def default_get(self, fields):
        res = super().default_get(fields)
        if self.env.context.get('documents_project') and not res.get('parent_folder_id'):
            res['parent_folder_id'] = self.company_id.project_documents_parent_folder.id
        return res

    project_ids = fields.One2many('project.project', 'documents_folder_id')

    @api.model
    def _name_search(self, name='', args=None, operator='ilike', limit=100, name_get_uid=None):
        domain = args
        if 'project_documents_template_folder' in self.env.context:
            template_folder_id = self.env.context.get('project_documents_template_folder')
            domain = expression.AND([
                domain,
                ['!', ('id', 'child_of', template_folder_id)]
            ])
        return super()._name_search(name, domain, operator, limit, name_get_uid)

    def write(self, vals):
        if 'company_id' in vals and vals['company_id']:
            for folder in self:
                if folder.project_ids and folder.project_ids.company_id:
                    different_company_projects = folder.project_ids.filtered(lambda project: project.company_id.id != vals['company_id'])
                    if not different_company_projects:
                        break
                    if len(different_company_projects) == 1:
                        project = different_company_projects[0]
                        message = _('This workspace should remain in the same company as the "%s" project to which it is linked. Please update the company of the "%s" project, or leave the company of this workspace empty.', project.name, project.name),
                    else:
                        lines = [f"- {project.name}" for project in different_company_projects]
                        message = _('This workspace should remain in the same company as the following projects to which it is linked:\n%s\n\nPlease update the company of those projects, or leave the company of this workspace empty.', '\n'.join(lines)),
                    raise UserError(message)

            self.env['res.company'].sudo().search([('id', '!=', vals['company_id']), ('project_documents_parent_folder', 'in', self.ids)]).project_documents_parent_folder = False
            self.env['res.company'].sudo().search([('id', '!=', vals['company_id']), ('project_documents_template_folder', 'in', self.ids)]).project_documents_template_folder = False
        return super().write(vals)
