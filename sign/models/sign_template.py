# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import re
import base64
import io

from PyPDF2 import PdfFileReader
from collections import defaultdict

from odoo import api, fields, models, Command, _
from odoo.exceptions import UserError, AccessError, ValidationError
from odoo.tools import pdf


class SignTemplate(models.Model):
    _name = "sign.template"
    _description = "Signature Template"

    def _default_favorited_ids(self):
        return [(4, self.env.user.id)]

    attachment_id = fields.Many2one('ir.attachment', string="Attachment", required=True, ondelete='cascade')
    name = fields.Char(related='attachment_id.name', readonly=False, store=True)
    num_pages = fields.Integer('Number of pages', compute="_compute_num_pages", readonly=True, store=True)
    datas = fields.Binary(related='attachment_id.datas', readonly=False)
    sign_item_ids = fields.One2many('sign.item', 'template_id', string="Signature Items", copy=True)
    responsible_count = fields.Integer(compute='_compute_responsible_count', string="Responsible Count")

    active = fields.Boolean(default=True, string="Active")
    privacy = fields.Selection([('employee', 'All Users'), ('invite', 'On Invitation')],
                               string="Who can Sign", default="invite",
                               help="Set who can use this template:\n"
                                    "- All Users: all users of the Sign application can view and use the template\n"
                                    "- On Invitation: only invited users can view and use the template\n"
                                    "Invited users can always edit the document template.\n"
                                    "Existing requests based on this template will not be affected by changes.")
    favorited_ids = fields.Many2many('res.users', string="Invited Users", default=lambda s: s._default_favorited_ids(), copy=False)
    user_id = fields.Many2one('res.users', string="Responsible", default=lambda self: self.env.user)

    sign_request_ids = fields.One2many('sign.request', 'template_id', string="Signature Requests")

    tag_ids = fields.Many2many('sign.template.tag', string='Tags')
    color = fields.Integer()
    redirect_url = fields.Char(string="Redirect Link", default="",
        help="Optional link for redirection after signature")
    redirect_url_text = fields.Char(string="Link Label", default="Open Link", translate=True,
        help="Optional text to display on the button link")
    signed_count = fields.Integer(compute='_compute_signed_in_progress_template')
    in_progress_count = fields.Integer(compute='_compute_signed_in_progress_template')

    group_ids = fields.Many2many("res.groups", string="Template Access Group")

    is_sharing = fields.Boolean(compute='_compute_is_sharing', help='Checked if this template has created a shared document for you')

    @api.model
    def _name_search(self, name, args=None, operator='ilike', limit=100, name_get_uid=None):
        # Display favorite templates first
        args = args or []
        template_ids = self._search([('name', operator, name)] + args, limit=None, access_rights_uid=name_get_uid)
        templates = self.browse(template_ids)
        templates = templates.sorted(key=lambda t: self.env.user in t.favorited_ids, reverse=True)
        return templates[:limit].ids

    @api.depends('attachment_id.datas')
    def _compute_num_pages(self):
        for record in self:
            try:
                record.num_pages = self._get_pdf_number_of_pages(base64.b64decode(record.attachment_id.datas))
            except Exception:
                record.num_pages = 0

    @api.depends('sign_item_ids.responsible_id')
    def _compute_responsible_count(self):
        for template in self:
            template.responsible_count = len(template.sign_item_ids.mapped('responsible_id'))

    def _compute_signed_in_progress_template(self):
        sign_requests = self.env['sign.request'].read_group([('state', '!=', 'canceled')], ['state', 'template_id'], ['state', 'template_id'], lazy=False)
        signed_request_dict = defaultdict(int)
        in_progress_request_dict = defaultdict(int)
        for sign_request in sign_requests:
            if sign_request['state'] == 'sent':
                template_id = sign_request['template_id'][0]
                in_progress_request_dict[template_id] = sign_request['__count']
            elif sign_request['state'] == 'signed':
                template_id = sign_request['template_id'][0]
                signed_request_dict[template_id] = sign_request['__count']
        for template in self:
            template.signed_count = signed_request_dict[template.id]
            template.in_progress_count = in_progress_request_dict[template.id]

    @api.depends_context('uid')
    def _compute_is_sharing(self):
        sign_template_sharing_ids = set(self.env['sign.request'].search([
            ('state', '=', 'shared'), ('create_uid', '=', self.env.user.id), ('template_id', 'in', self.ids)
        ]).template_id.ids)
        for template in self:
            template.is_sharing = template.id in sign_template_sharing_ids

    @api.model
    def get_empty_list_help(self, help):
        if not self.env.ref('sign.template_sign_tour', raise_if_not_found=False) or not self.env.user.has_group('sign.group_sign_user'):
            return '<p class="o_view_nocontent_smiling_face">%s</p>' % _('Upload a PDF')
        return super().get_empty_list_help(help)

    @api.model_create_multi
    def create(self, vals_list):
        attachments = self.env['ir.attachment'].browse([vals.get('attachment_id') for vals in vals_list])
        for attachment in attachments:
            self._check_pdf_data_validity(attachment.datas)
        # copy the attachment if it has been attached to a record
        for vals, attachment in zip(vals_list, attachments):
            if attachment.res_model or attachment.res_id:
                vals['attachment_id'] = attachment.copy().id
            else:
                attachment.res_model = self._name
        templates = super().create(vals_list)
        for template, attachment in zip(templates, templates.attachment_id):
            attachment.write({
                'res_model': self._name,
                'res_id': template.id
            })
        return templates

    def copy(self, default=None):
        self.ensure_one()
        default = default or {}
        default['name'] = default.get('name', self._get_copy_name(self.name))
        return super().copy(default)

    @api.model
    def create_with_attachment_data(self, name, data, active=True):
        try:
            attachment = self.env['ir.attachment'].create({'name': name, 'datas': data})
            return self.create({'attachment_id': attachment.id, 'active': active}).id
        except UserError:
            return 0

    @api.model
    def _get_pdf_number_of_pages(self, pdf_data):
        file_pdf = PdfFileReader(io.BytesIO(pdf_data), strict=False, overwriteWarnings=False)
        return file_pdf.getNumPages()

    def go_to_custom_template(self, sign_directly_without_mail=False):
        self.ensure_one()
        return {
            'name': "Template \"%(name)s\"" % {'name': self.attachment_id.name},
            'type': 'ir.actions.client',
            'tag': 'sign.Template',
            'context': {
                'id': self.id,
                'sign_directly_without_mail': sign_directly_without_mail,
            },
        }

    def _check_send_ready(self):
        if any(item.type_id.item_type == 'selection' and not item.option_ids for item in self.sign_item_ids):
            raise UserError(_("One or more selection items have no associated options"))

    def toggle_favorited(self):
        self.ensure_one()
        self.write({'favorited_ids': [(3 if self.env.user in self[0].favorited_ids else 4, self.env.user.id)]})

    @api.ondelete(at_uninstall=False)
    def _unlink_except_existing_signature(self):
        if self.filtered(lambda template: template.sign_request_ids):
            raise UserError(_(
                "You can't delete a template for which signature requests "
                "exist but you can archive it instead."))

    @api.model
    def _check_pdf_data_validity(self, datas):
        try:
            self._get_pdf_number_of_pages(base64.b64decode(datas))
        except Exception as e:
            raise UserError(_("One uploaded file cannot be read. Is it a valid PDF?"))

    def update_from_pdfviewer(self, sign_items=None, deleted_sign_item_ids=None, name=None):
        """ Update a sign.template from the pdfviewer
        :param dict sign_items: {id (str): values (dict)}
            id: positive: sign.item's id in database (the sign item is already in the database and should be update)
                negative: negative random itemId(transaction_id) in pdfviewer (the sign item is new created in the pdfviewer and should be created in database)
            values: values to update/create
        :param list(str) deleted_sign_item_ids: list of ids of deleted sign items. These deleted ids may be
            positive: the sign item exists in the database
            negative: the sign item is new created in pdfviewer but removed before a successful transaction
        :return: dict new_id_to_item_id_map: {negative itemId(transaction_id) in pdfviewer (str): positive id in database (int)}
        """
        self.ensure_one()
        if len(self.sign_request_ids) > 0:
            return False
        if sign_items is None:
            sign_items = {}

        # The name may be "" and None here. And the attachment_id.name is forcely written here to retry the method and
        # avoid recreating new sign items when two RPCs arrive at the same time
        self.attachment_id.name = name if name else self.attachment_id.name

        # update new_sign_items to avoid recreating sign items
        new_sign_items = dict(sign_items)
        sign_items_exist = self.sign_item_ids.filtered(lambda r: str(r.transaction_id) in sign_items)
        for sign_item in sign_items_exist:
            new_sign_items[str(sign_item.id)] = new_sign_items.pop(str(sign_item.transaction_id))
        new_id_to_item_id_map = {str(sign_item.transaction_id): sign_item.id for sign_item in sign_items_exist}

        # unlink sign items
        deleted_sign_item_ids = set() if deleted_sign_item_ids is None else set(deleted_sign_item_ids)
        self.sign_item_ids.filtered(lambda r: r.id in deleted_sign_item_ids or (r.transaction_id in deleted_sign_item_ids)).unlink()

        # update existing sign items
        for item in self.sign_item_ids.filtered(lambda r: str(r.id) in new_sign_items):
            item.write(new_sign_items.pop(str(item.id)))

        # create new sign items
        new_values_list = []
        for key, values in new_sign_items.items():
            if int(key) < 0:
                values['template_id'] = self.id
                new_values_list.append(values)
        new_id_to_item_id_map.update(zip(new_sign_items.keys(), self.env['sign.item'].create(new_values_list).ids))

        return new_id_to_item_id_map

    @api.model
    def _get_copy_name(self, name):
        regex = re.compile(r' \(v(\d+)\)$')
        match = regex.search(name)
        version = str(int(match.group(1)) + 1) if match else "2"
        index = match.start() if match else len(name)
        return name[:index] + " (v" + version + ")"

    @api.model
    def rotate_pdf(self, template_id=None):
        template = self.browse(template_id)
        if len(template.sign_request_ids) > 0:
            return False

        template.datas = base64.b64encode(pdf.rotate_pdf(base64.b64decode(template.datas)))

        return True

    def open_requests(self):
        return {
            "type": "ir.actions.act_window",
            "name": _("Sign requests"),
            "res_model": "sign.request",
            "res_id": self.id,
            "domain": [["template_id", "in", self.ids]],
            "views": [[False, 'kanban'], [False, "form"]],
            "context": {'search_default_signed': True}
        }

    def open_shared_sign_request(self):
        self.ensure_one()
        shared_sign_request = self.sign_request_ids.filtered(lambda sr: sr.state == 'shared' and sr.create_uid == self.env.user)
        if not shared_sign_request:
            shared_sign_request = self.env['sign.request'].with_context(no_sign_mail=True).create({
                'template_id': self.id,
                'request_item_ids': [Command.create({'role_id': self.sign_item_ids.responsible_id.id or self.env.ref('sign.sign_item_role_default').id})],
                'reference': "%s-%s" % (self.name, _("Shared")),
                'state': 'shared',
            })
        return {
            "name": _("Share Document by Link"),
            'type': 'ir.actions.act_window',
            "res_model": "sign.request",
            "res_id": shared_sign_request.id,
            "target": "new",
            'views': [[self.env.ref("sign.sign_request_share_view_form").id, 'form']],
        }

    def stop_sharing(self):
        self.ensure_one()
        return self.sign_request_ids.filtered(lambda sr: sr.state == 'shared' and sr.create_uid == self.env.user).unlink()

    def _copy_sign_items_to(self, new_template):
        """ copy all sign items of the self template to the new_template """
        self.ensure_one()
        if len(new_template.sign_request_ids) > 0:
            raise UserError(_("Somebody is already filling a document which uses this template"))
        item_id_map = {}
        for sign_item in self.sign_item_ids:
            new_sign_item = sign_item.copy({'template_id': new_template.id})
            item_id_map[str(sign_item.id)] = str(new_sign_item.id)
        return item_id_map

    def _get_sign_items_by_page(self):
        self.ensure_one()
        items = defaultdict(list)
        for item in self.sign_item_ids:
            items[item.page].append(item)
        return items


class SignTemplateTag(models.Model):

    _name = "sign.template.tag"
    _description = "Sign Template Tag"
    _order = "name"

    name = fields.Char('Tag Name', required=True, translate=True)
    color = fields.Integer('Color Index')

    _sql_constraints = [
        ('name_uniq', 'unique (name)', "Tag name already exists !"),
    ]


class SignItemSelectionOption(models.Model):
    _name = "sign.item.option"
    _description = "Option of a selection Field"

    value = fields.Text(string="Option")

    @api.model
    def get_or_create(self, value):
        option = self.search([('value', '=', value)], limit=1)
        return option.id if option else self.create({'value': value}).id


class SignItem(models.Model):
    _name = "sign.item"
    _description = "Fields to be sign on Document"
    _rec_name = 'template_id'

    template_id = fields.Many2one('sign.template', string="Document Template", required=True, ondelete='cascade')

    type_id = fields.Many2one('sign.item.type', string="Type", required=True, ondelete='cascade')

    required = fields.Boolean(default=True)
    responsible_id = fields.Many2one("sign.item.role", string="Responsible", ondelete="restrict")

    option_ids = fields.Many2many("sign.item.option", string="Selection options")

    name = fields.Char(string="Field Name")
    page = fields.Integer(string="Document Page", required=True, default=1)
    posX = fields.Float(digits=(4, 3), string="Position X", required=True)
    posY = fields.Float(digits=(4, 3), string="Position Y", required=True)
    width = fields.Float(digits=(4, 3), required=True)
    height = fields.Float(digits=(4, 3), required=True)
    alignment = fields.Char(default="center", required=True)

    transaction_id = fields.Integer(copy=False)


class SignItemType(models.Model):
    _name = "sign.item.type"
    _description = "Signature Item Type"

    name = fields.Char(string="Field Name", required=True, translate=True)
    item_type = fields.Selection([
        ('signature', "Signature"),
        ('initial', "Initial"),
        ('text', "Text"),
        ('textarea', "Multiline Text"),
        ('checkbox', "Checkbox"),
        ('selection', "Selection"),
    ], required=True, string='Type', default='text')

    tip = fields.Char(required=True, default="fill in", translate=True)
    placeholder = fields.Char(translate=True)

    default_width = fields.Float(string="Default Width", digits=(4, 3), required=True, default=0.150)
    default_height = fields.Float(string="Default Height", digits=(4, 3), required=True, default=0.015)
    auto_field = fields.Char(string="Auto-fill Partner Field",
        help="Technical name of the field on the partner model to auto-complete this signature field at the time of signature.")

    @api.constrains('auto_field')
    def _check_auto_field_exists(self):
        Partner = self.env['res.partner']
        for sign_type in self:
            if sign_type.auto_field:
                try:
                    if isinstance(Partner.sudo().mapped(sign_type.auto_field), models.BaseModel):
                        raise AttributeError
                except (KeyError, AttributeError):
                    raise ValidationError(_("Malformed expression: %(exp)s", exp=sign_type.auto_field))


class SignItemParty(models.Model):
    _name = "sign.item.role"
    _description = "Signature Item Party"

    name = fields.Char(required=True, translate=True)
    color = fields.Integer()
    default = fields.Boolean(required=True, default=False)

    sms_authentification = fields.Boolean('SMS Authentication')
    change_authorized = fields.Boolean('Change Authorized')

    @api.model
    def get_or_create(self, name):
        party = self.search([('name', '=', name)], limit=1)
        party = party if party else self.create({'name': name})
        return {'id': party.id, 'name': party.name, 'color': party.color}
