# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from ast import literal_eval
from lxml import etree
import time

from odoo import api, fields, models, _
from odoo.exceptions import ValidationError
from odoo.addons.base.models.ir_model import MODULE_UNINSTALL_FLAG


class ProjectWorksheetTemplate(models.Model):
    _name = 'project.worksheet.template'
    _description = 'Project Worksheet Template'

    name = fields.Char(string='Name', required=True)
    sequence = fields.Integer()
    worksheet_count = fields.Integer(compute='_compute_worksheet_count')
    model_id = fields.Many2one('ir.model', ondelete='cascade', readonly=True, domain=[('state', '=', 'manual')])
    action_id = fields.Many2one('ir.actions.act_window', readonly=True)
    report_view_id = fields.Many2one('ir.ui.view', domain=[('type', '=', 'qweb')], readonly=True)
    active = fields.Boolean(default=True)

    def _compute_worksheet_count(self):
        for record in self:
            record.worksheet_count = record.model_id and self.env[record.model_id.model].search_count([]) or 0

    @api.constrains('report_view_id', 'model_id')
    def _check_report_view_type(self):
        for worksheet_template in self:
            if worksheet_template.model_id and worksheet_template.report_view_id:
                if worksheet_template.report_view_id.type != 'qweb':
                    raise ValidationError(_('The template to print this worksheet template should be a QWeb template.'))

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
                    'name': 'x_comments',
                    'ttype': 'text',
                    'field_description': 'Comments',
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
                    <h1 invisible="context.get('studio') or context.get('default_x_task_id')">
                            <field name="x_task_id" domain="[('is_fsm', '=', True)]"/>
                    </h1>
                    <group>
                        <group>
                            <field name="x_comments"/>
                        </group>
                        <group>
                        </group>
                    </group>
                </sheet>
            </form>
            """
        })
        action = self.env['ir.actions.act_window'].sudo().create({
            'name': 'Worksheets',
            'res_model': model.model,
            'view_mode': 'tree,form',
            'target': 'current',
            'context': {
                'edit': False,
                'create': False,
                'delete': False,
            }
        })
        # generate an xmlid for the action, studio requires it to activate the studio
        # systray item
        self.env['ir.model.data'].sudo().create({
            'name': 'template_action_' + "_".join(template.name.split(' ')),
            'model': 'ir.actions.act_window',
            'module': 'industry_fsm_report',
            'res_id': action.id,
            'noupdate': True,
        })
        template.write({
            'action_id': action.id,
            'model_id': model.id,
        })
        # this must be done after form view creation and filling the 'model_id' field
        template.sudo()._generate_qweb_report_template()

        return template

    def unlink(self):
        models_ids = self.mapped('model_id.id')
        self.env['ir.ui.view'].search([('model', 'in', self.mapped('model_id.model'))]).unlink()
        self.env['ir.model.access'].search([('model_id', 'in', models_ids)]).unlink()
        x_name_fields = self.env['ir.model.fields'].search([('model_id', 'in', models_ids), ('name', '=', 'x_name')])
        x_name_fields.write({'related': False})  # we need to manually remove relation to allow the deletion of fields
        self.env['ir.rule'].search([('model_id', 'in', models_ids)]).unlink()
        self.mapped('action_id').unlink()

        # context needed to avoid "manual" removal of related fields
        self.mapped('model_id').with_context(**{MODULE_UNINSTALL_FLAG: True}).unlink()

        return super(ProjectWorksheetTemplate, self).unlink()

    def action_view_worksheets(self):
        action = self.action_id.read()[0]
        # modify context to force no create/import button
        context = literal_eval(action.get('context', '{}'))
        context['create'] = 0
        action['context'] = context
        return action

    # ---------------------------------------------------------
    # Actions
    # ---------------------------------------------------------

    def action_fsm_report(self):
        self.ensure_one()
        return {
            'name': _('Analysis'),
            'type': 'ir.actions.act_window',
            'view_mode': 'graph,pivot,list,form',
            'res_model': self.model_id.model,
            'context': {
                'fsm_mode': True,
            }
        }

    # ---------------------------------------------------------
    # Business Methods
    # ---------------------------------------------------------

    def get_x_model_form_action(self):
        action = self.action_id.read()[0]
        action.update({
            'views': [[False, "form"]],
            'context': {'default_x_task_id': True,  # to hide task_id from view
                        'form_view_initial_mode': 'readonly'}  # to avoid edit mode at studio exit
        })
        return action

    def _get_qweb_arch_omitted_fields(self):
        return [
            'x_task_id', 'x_name',  # redundants
            'x_customer_signature', 'x_worker_signature'  # treated separately by the template
        ]

    @api.model
    def _get_qweb_arch(self, ir_model, qweb_template_name, form_view_id=False):
        """ This function generates a qweb arch, from the form view of the given ir.model record.
            This is needed because the number and names of the fields aren't known in advance.
            :param ir_model: ir.model record
            :returns the arch of the template qweb (t-name included)
        """
        fields_view_get_result = self.env[ir_model.model].fields_view_get(view_id=form_view_id, view_type='form', toolbar=False, submenu=False)
        form_view_arch = fields_view_get_result['arch']
        form_view_fields = fields_view_get_result['fields']

        qweb_arch = etree.Element("div")
        for field_node in etree.fromstring(form_view_arch).xpath('//field'):
            field_name = field_node.attrib['name']
            if field_name not in self._get_qweb_arch_omitted_fields():
                field_info = form_view_fields[field_name]

                widget = field_node.attrib.get('widget', False)
                # no signature widget in qweb
                if widget == 'signature':
                    widget = 'image'
                # adapt the widget syntax
                if widget:
                    field_node.attrib['t-options'] = "{'widget': '%s'}" % widget
                    field_node.attrib.pop('widget')
                # basic form view -> qweb node transformation
                if field_info['type'] != 'binary' or widget in ['image']:
                    # adapt the field node itself
                    field_node.tag = 'div'
                    field_node.attrib['t-field'] = 'worksheet.' + field_node.attrib['name']
                    field_node.attrib['class'] = 'text-wrap col-9'
                    field_node.attrib.pop('name')
                    # generate a description
                    description = etree.Element('div', {'class': 'col-3 font-weight-bold'})
                    description.text = field_info['string']
                    # insert all that in a container
                    container = etree.Element('div', {'class': 'row mb-2', 'style': 'page-break-inside: avoid'})
                    container.append(description)
                    container.append(field_node)
                    qweb_arch.append(container)

        t_root = etree.Element('t', {'t-name': qweb_template_name})
        t_root.append(qweb_arch)
        return etree.tostring(t_root)

    def _generate_qweb_report_template(self):
        for worksheet_template in self:
            report_name = ('%s_%s') % (worksheet_template.model_id.model.replace('.', '_'), str(time.time()))
            new_arch = self._get_qweb_arch(worksheet_template.model_id, report_name)
            if worksheet_template.report_view_id:  # update existing one
                worksheet_template.report_view_id.write({'arch': new_arch})
            else:  # create the new one
                report_view = self.env['ir.ui.view'].create({
                    'type': 'qweb',
                    'model': False,  # template qweb for report
                    'inherit_id': False,
                    'mode': 'primary',
                    'arch': new_arch,
                    'name': report_name
                })
                self.env['ir.model.data'].create({
                    'name': 'industry_fsm_report._custom_%s' % (report_name,),
                    'module': 'industry_fsm_report',
                    'res_id': report_view.id,
                    'model': 'ir.ui.view',
                    'noupdate': True,
                })
                # linking the new one
                worksheet_template.write({'report_view_id': report_view.id})
