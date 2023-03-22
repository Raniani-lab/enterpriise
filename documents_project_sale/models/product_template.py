# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import _, api, fields, models
from odoo.exceptions import UserError


class ProductTemplate(models.Model):
    _inherit = 'product.template'

    documents_allowed_company_id = fields.Many2one('res.company', compute='_compute_documents_allowed_company_id')
    template_folder_id = fields.Many2one('documents.folder', "Workspace Template", company_dependent=True, copy=True,
        domain="['|', ('company_id', '=', False), ('company_id', '=', documents_allowed_company_id)]",
        help="On sales order confirmation, a workspace will be automatically generated for the project based on this template.")

    @api.depends('company_id')
    def _compute_documents_allowed_company_id(self):
        for template in self:
            template.documents_allowed_company_id = template.company_id if template.company_id else self.env.company

    @api.onchange('company_id')
    def _onchange_company_id(self):
        if self.template_folder_id and self.template_folder_id.company_id and self.company_id != self.template_folder_id.company_id:
            self.template_folder_id = False

    @api.constrains('template_folder_id')
    def _check_company_is_folder_company(self):
        for product in self:
            if product.template_folder_id and product.template_folder_id.company_id and product.company_id != product.template_folder_id.company_id:
                raise UserError(_('The "%s" workspace template should either be in the "%s" company like this product or be open to all companies.', product.template_folder_id.name, product.company_id.name))
