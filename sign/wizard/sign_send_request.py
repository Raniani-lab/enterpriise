# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _, Command
from odoo.exceptions import UserError


class SignSendRequest(models.TransientModel):
    _name = 'sign.send.request'
    _description = 'Sign send request'

    @api.model
    def default_get(self, fields):
        res = super(SignSendRequest, self).default_get(fields)
        if not res.get('template_id'):
            return res
        template = self.env['sign.template'].browse(res['template_id'])
        res['has_default_template'] = bool(template)
        template.check_send_ready()
        if 'filename' in fields:
            res['filename'] = template.display_name
        if 'subject' in fields:
            res['subject'] = _("Signature Request - %(file_name)s", file_name=template.attachment_id.name)
        if 'signers_count' in fields or 'signer_ids' in fields or 'signer_id' in fields:
            roles = template.sign_item_ids.responsible_id
            if 'signers_count' in fields:
                res['signers_count'] = len(roles)
            if 'signer_ids' in fields:
                res['signer_ids'] = [(0, 0, {
                    'role_id': role.id,
                    'partner_id': False,
                }) for role in roles]
            if self.env.context.get('sign_directly_without_mail'):
                if len(roles) == 1 and 'signer_ids' in fields and res.get('signer_ids'):
                    res['signer_ids'][0][2]['partner_id'] = self.env.user.partner_id.id
                elif not roles and 'signer_id' in fields:
                    res['signer_id'] = self.env.user.partner_id.id
        return res

    activity_id = fields.Many2one('mail.activity', 'Linked Activity', readonly=True)
    has_default_template = fields.Boolean()
    template_id = fields.Many2one(
        'sign.template', required=True, ondelete='cascade',
        default=lambda self: self.env.context.get('active_id', None),
    )
    signer_ids = fields.One2many('sign.send.request.signer', 'sign_send_request_id', string="Signers")
    signer_id = fields.Many2one('res.partner', string="Send To")
    signers_count = fields.Integer()
    cc_partner_ids = fields.Many2many('res.partner', string="Copy to", help="Contacts in copy will be notified by email once the document is either fully signed or refused.")
    is_user_signer = fields.Boolean(compute='_compute_is_user_signer')
    refusal_allowed = fields.Boolean(default=False, string="Can be refused", help="Allow the contacts to refuse the document for a specific reason.")

    subject = fields.Char(string="Subject", required=True)
    message = fields.Html("Message", help="Message to be sent to signers of the specified document")
    message_cc = fields.Html("CC Message", help="Message to be sent to contacts in copy of the signed document")
    attachment_ids = fields.Many2many('ir.attachment', string='Attachments')
    filename = fields.Char("Filename", required=True)

    @api.onchange('template_id')
    def _onchange_template_id(self):
        self.signer_id = False
        self.filename = self.template_id.display_name
        self.subject = _("Signature Request - %s") % (self.template_id.attachment_id.name or '')
        roles = self.template_id.mapped('sign_item_ids.responsible_id')
        signer_ids = [(0, 0, {
            'role_id': role.id,
            'partner_id': False,
        }) for role in roles]
        if self.env.context.get('sign_directly_without_mail'):
            if len(roles) == 1:
                signer_ids[0][2]['partner_id'] = self.env.user.partner_id.id
            elif not roles:
                self.signer_id = self.env.user.partner_id.id
        self.signer_ids = [(5, 0, 0)] + signer_ids
        self.signers_count = len(roles)

    @api.depends('signer_ids.partner_id', 'signer_id', 'signers_count')
    def _compute_is_user_signer(self):
        if self.signers_count and self.env.user.partner_id in self.signer_ids.mapped('partner_id'):
            self.is_user_signer = True
        elif not self.signers_count and self.env.user.partner_id == self.signer_id:
            self.is_user_signer = True
        else:
            self.is_user_signer = False

    def _activity_done(self):
        signatories = self.signer_id.name or ', '.join(self.signer_ids.partner_id.mapped('name'))
        feedback = _('Signature requested for template: %s\nSignatories: %s') % (self.template_id.name, signatories)
        self.activity_id._action_done(feedback=feedback)

    def create_request(self):
        template_id = self.template_id.id
        if self.signers_count:
            signers = [{'partner_id': signer.partner_id.id, 'role_id': signer.role_id.id} for signer in self.signer_ids]
        else:
            signers = [{'partner_id': self.signer_id.id, 'role_id': self.env.ref('sign.sign_item_role_default').id}]
        cc_partner_ids = self.cc_partner_ids.ids
        reference = self.filename
        subject = self.subject
        message = self.message
        message_cc = self.message_cc
        attachment_ids = self.attachment_ids
        refusal_allowed = self.refusal_allowed
        return self.env['sign.request'].create({
            'template_id': template_id,
            'request_item_ids': [Command.create({
                'partner_id': signer['partner_id'],
                'role_id': signer['role_id'],
            }) for signer in signers],
            'cc_partner_ids': [Command.set(cc_partner_ids)],
            'reference': reference,
            'subject': subject,
            'message': message,
            'message_cc': message_cc,
            'attachment_ids': [Command.set(attachment_ids.ids)],
            'refusal_allowed': refusal_allowed,
        })

    def send_request(self):
        request = self.create_request()
        if self.activity_id:
            self._activity_done()
            return {'type': 'ir.actions.act_window_close'}
        return request.go_to_document()

    def sign_directly(self):
        request = self.create_request()
        if self.activity_id:
            self._activity_done()
        if self._context.get('sign_all'):
            return request.go_to_signable_document(request.request_item_ids)
        return request.go_to_signable_document()


class SignSendRequestSigner(models.TransientModel):
    _name = "sign.send.request.signer"
    _description = 'Sign send request signer'

    role_id = fields.Many2one('sign.item.role', readonly=True, required=True)
    partner_id = fields.Many2one('res.partner', required=True, string="Contact")
    sign_send_request_id = fields.Many2one('sign.send.request')

    def create(self, vals_list):
        missing_roles = []
        for vals in vals_list:
            if not vals.get('partner_id'):
                role_id = vals.get('role_id')
                role = self.env['sign.item.role'].browse(role_id)
                missing_roles.append(role.name)
        if missing_roles:
            missing_roles_str = ', '.join(missing_roles)
            raise UserError(_(
                'The following roles must be set to create the signature request: %(roles)s',
                roles=missing_roles_str,
            ))
        return super().create(vals_list)
