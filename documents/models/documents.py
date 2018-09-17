# -*- coding: utf-8 -*-
from odoo import models, fields, api, exceptions, SUPERUSER_ID
from odoo.tools import crop_image, image_resize_image
from ast import literal_eval
import re
import base64


class IrAttachment(models.Model):
    _name = 'ir.attachment'
    _inherit = ['ir.attachment', 'mail.thread']

    favorited_ids = fields.Many2many('res.users', string="Favorite of")
    tag_ids = fields.Many2many('documents.tag', 'document_tag_rel', string="Tags")
    partner_id = fields.Many2one('res.partner', string="Contact", track_visibility='onchange')
    owner_id = fields.Many2one('res.users', default=lambda self: self.env.user.id, string="Owner",
                               track_visibility='onchange')
    available_rule_ids = fields.Many2many('documents.workflow.rule', compute='_compute_available_rules',
                                          string='Available Rules')
    folder_id = fields.Many2one('documents.folder', ondelete="restrict", track_visibility="onchange")
    lock_uid = fields.Many2one('res.users', string="Locked by")

    @api.onchange('url')
    def _on_url_change(self):
        if self.url:
            self.name = self.url[self.url.rfind('/')+1:]

    @api.multi
    def _compute_available_rules(self, folder_id=None):
        """
        loads the rules that can be applied to the attachment.

        :param folder_id: the id of the current folder (used to lighten the search)
        """
        if not folder_id and self[0].folder_id:
            folder_id = self[0].folder_id.id
        rule_domain = [('domain_folder_id', 'parent_of', folder_id)] if folder_id else []
        rules = self.env['documents.workflow.rule'].search(rule_domain)
        for rule in rules:
            domain = []
            if rule.condition_type == 'domain':
                domain = literal_eval(rule.domain) if rule.domain else []
            else:
                if rule.criteria_partner_id:
                    domain += [['partner_id', '=', rule.criteria_partner_id.id]]
                if rule.criteria_owner_id:
                    domain += [['owner_id', '=', rule.criteria_owner_id.id]]
                if rule.create_model:
                    domain += [['type', '!=', 'url']]
                if rule.criteria_tag_ids:
                    contains_array = []
                    not_contains_array = []
                    for criteria_tag in rule.criteria_tag_ids:
                        if criteria_tag.operator == 'contains':
                            contains_array.append(criteria_tag.tag_id.id)
                        elif criteria_tag.operator == 'notcontains':
                            not_contains_array.append(criteria_tag.tag_id.id)
                    if len(contains_array):
                        domain += [['tag_ids', 'in', contains_array]]
                    domain += [['tag_ids', 'not in', not_contains_array]]

            folder_domain = [['folder_id', 'child_of', rule.domain_folder_id.id]]
            subset = [['id', 'in', self.ids]] + domain + folder_domain
            attachment_ids = self.env['ir.attachment'].search(subset)
            for attachment in attachment_ids:
                attachment.available_rule_ids = [(4, rule.id, False)]

    @api.model
    def message_new(self, msg_dict, custom_values=None):
        """
        creates a new attachment from any email sent to the alias
        and adds the values defined in the share link upload settings
        to the custom values.
        """
        subject = msg_dict.get('subject', '')
        body = msg_dict.get('body', '')
        if custom_values is None:
            custom_values = {}
        defaults = {
            'datas_fname': "Mail: %s.txt" % subject,
            'mimetype': 'text/plain',
            'datas': base64.b64encode(bytes(body, 'utf-8')),
        }
        defaults.update(custom_values)

        mail_attachment = super(IrAttachment, self).message_new(msg_dict, defaults).with_context(attachment_values=
                                                                                                 custom_values)

        return mail_attachment

    @api.model
    def _message_post_process_attachments(self, attachments, attachment_ids, message_data):
        """
        If the res model was an attachment and a mail, adds all the custom values of the share link
            settings to the attachments of the mail.

        rv: a list of write commands [(4, attachment_id),]
        """
        rv = super(IrAttachment, self)._message_post_process_attachments(attachments, attachment_ids, message_data)
        dv = self._context.get('attachment_values')
        if message_data['model'] == 'ir.attachment' and dv:
            write_vals = {
                'partner_id': dv['partner_id'],
                'tag_ids': dv['tag_ids'],
                'folder_id': dv['folder_id'],
            }
            attachments = self.env['ir.attachment'].browse([x[1] for x in rv])
            for attachment in attachments:
                attachment.write(write_vals)
        return rv

    @api.multi
    def toggle_favorited(self):
        self.ensure_one()
        self.write({'favorited_ids': [(3 if self.env.user in self[0].favorited_ids else 4, self.env.user.id)]})

    @api.multi
    def toggle_lock(self):
        """
        sets a lock user, the lock user is the user who locks a file for themselves, preventing data replacement
        and archive (therefore deletion) for any user but himself.

        Members of the group documents.group_document_manager and the superuser can unlock the file regardless.
        """
        self.ensure_one()
        if self.lock_uid and (self.lock_uid in (self.env.user, SUPERUSER_ID) or self.user_has_groups(
                'documents.group_document_manager')):
            self.lock_uid = False
        else:
            self.lock_uid = self.env.uid

    @api.multi
    def refresh_write(self):
        return {
            'type': 'ir.actions.client',
            'tag': 'reload',
        }
