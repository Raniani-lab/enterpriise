# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models



class ProjectWorksheetTemplate(models.Model):
    _name = 'project.worksheet.template'
    _description = 'Project Worksheet Template'

    name = fields.Char(string='Name', required=True)
    sequence = fields.Integer()
    worksheet_count = fields.Integer(compute='_compute_worksheet_count')
    model_id = fields.Many2one('ir.model', ondelete='cascade', readonly=True, domain=[('state', '=', 'manual')])
    action_id = fields.Many2one('ir.actions.act_window', readonly=True)
    active = fields.Boolean(default=True)

    def _compute_worksheet_count(self):
        for record in self:
            if record.model_id:
                record.worksheet_count = self.env[record.model_id.model].search_count([])

    @api.model
    def create(self, vals):
        template = super(ProjectWorksheetTemplate, self).create(vals)
        name = 'x_project_worksheet_template_' + str(template.id)
        model = self.env['ir.model'].sudo().create({
            'name': vals['name'],
            'model': name,
            'field_id': [
                (0, 0, {  # needed for proper model creation from demo data
                    'name': 'x_name',
                    'field_description': 'Name',
                    'ttype': 'char',
                }),
                (0, 0, {
                    'name': 'x_task_id',
                    'field_description': 'Task',
                    'ttype': 'many2one',
                    'relation': 'project.task',
                    'required': True,
                    'on_delete': 'cascade',
                }),
                (0, 0, {
                    'name': 'x_contact_person',
                    'ttype': 'char',
                    'field_description': 'Contact Person',
                }),
                (0, 0, {
                    'name': 'x_intervention_type',
                    'ttype': 'selection',
                    'field_description': 'Intervention Type',
                    'selection': "[('functional','Functional'),('technical','Technical')]"
                }),
                (0, 0, {
                    'name': 'x_comments',
                    'ttype': 'text',
                    'field_description': 'Comments',
                }),
                (0, 0, {
                    'name': 'x_customer_signature',
                    'ttype': 'binary',
                    'field_description': 'Customer Signature',
                }),
                (0, 0, {
                    'name': 'x_worker_signature',
                    'ttype': 'binary',
                    'field_description': 'Worker Signature',
                }),
            ]
        })
        self.env['ir.model.access'].sudo().create({
            'name': name + '_access',
            'model_id': model.id,
            'group_id': self.env.ref('project.group_project_manager').id,
            'perm_create': True,
            'perm_write': True,
            'perm_read': True,
            'perm_unlink': True,
        })
        self.env['ir.model.access'].sudo().create({
            'name': name + '_access',
            'model_id': model.id,
            'group_id': self.env.ref('project.group_project_user').id,
            'perm_create': True,
            'perm_write': True,
            'perm_read': True,
            'perm_unlink': True,
        })
        self.env['ir.rule'].sudo().create({
            'name': name + '_own',
            'model_id': model.id,
            'domain_force': "[('create_uid', '=', user.id)]",
            'groups': [(6, 0, [self.env.ref('project.group_project_user').id])]
            })
        self.env['ir.rule'].sudo().create({
            'name': name + '_all',
            'model_id': model.id,
            'domain_force': [(1, '=', 1)],
            'groups': [(6, 0, [self.env.ref('project.group_project_manager').id])]
            })
        x_name_field = self.env['ir.model.fields'].search([('model_id', '=', model.id), ('name', '=', 'x_name')])
        x_name_field.sudo().write({'related': 'x_task_id.name'})  # possible only after target field have been created
        self.env['ir.ui.view'].sudo().create({
            'type': 'form',
            'model': model.model,
            'arch': """
            <form>
                <sheet>
                    <group invisible="context.get('studio') or context.get('default_x_task_id')">
                        <group>
                            <field name="x_task_id" domain="[('allow_worksheets', '=', True)]"/>
                        </group>
                    </group>
                    <group>
                        <group>
                            <field name="x_contact_person" placeholder="Employee of the Customer"/>
                            <field name="x_intervention_type"/>
                            <field name="x_comments"/>
                            <field name="x_worker_signature" widget="signature"/>
                            <field name="x_customer_signature" widget="signature"/>
                        </group>
                        <group>
                        </group>
                    </group>
                </sheet>
            </form>
            """
        })
        action = self.env['ir.actions.act_window'].sudo().create({
            'name': 'Project Template : ' + template.name,
            'res_model': model.model,
            'view_type': 'form',
            'view_mode': 'tree,form',
            'target': 'current',
        })
        template.write({
            'action_id': action.id,
            'model_id': model.id,
        })

        return template

    @api.multi
    def unlink(self):
        models_ids = self.mapped('model_id.id')
        self.env['ir.ui.view'].search([('model', 'in', self.mapped('model_id.model'))]).unlink()
        self.env['ir.model.access'].search([('model_id', 'in', models_ids)]).unlink()
        x_name_fields = self.env['ir.model.fields'].search([('model_id', 'in', models_ids), ('name', '=', 'x_name')])
        x_name_fields.write({'related': False})  # we need to manually remove relation to allow the deletion of fields
        self.env['ir.rule'].search([('model_id', 'in', models_ids)]).unlink()
        self.mapped('action_id').unlink()
        self.mapped('model_id').unlink()
        return super(ProjectWorksheetTemplate, self).unlink()

    def action_view_worksheets(self):
        return self.action_id.read()[0]

    def get_x_model_form_action(self):
        action = self.action_id.read()[0]
        action.update({
            'views': [[False, "form"]],
            'context': {'default_x_task_id': True,  # to hide task_id from view
                        'form_view_initial_mode': 'readonly'}  # to avoid edit mode at studio exit
        })
        return action
