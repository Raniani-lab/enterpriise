# -*- coding: utf-8 -*-

from odoo.addons.iap import jsonrpc
from odoo import api, exceptions, fields, models, _
from odoo.exceptions import AccessError
import pickle
import logging
import base64
import json

_logger = logging.getLogger(__name__)

DEFAULT_ENDPOINT = "https://iap-invoice_ocr.odoo.com"
CLIENT_OCR_VERSION = 100

def to_float(text):
    """format a text to try to find a float in it. Ex: 127,00  320.612,8  15.9"""
    t_no_space = text.replace(" ", "")
    char = ""
    for c in t_no_space:
        if c in ['.', ',']:
            char = c
    if char == ",":
        t_no_space = t_no_space.replace(".", "")
        t_no_space = t_no_space.replace(",", ".")
    elif char == ".":
        t_no_space = t_no_space.replace(",", "")
    try:
        return float(t_no_space)
    except AttributeError:
        return None 

class AccountInvoiceExtractionWords(models.Model):

    _name = "account.invoice.extraction_words"

    invoice_id = fields.Many2one("account.invoice", help="Invoice id")
    field = fields.Char("account.invoice_extract.field", help="field for which the word has been extracted")
    ocr_selected = fields.Boolean("account.invoice_extract_ocr_selected")
    user_selected = fields.Boolean("account.invoice_extract_user_selected")
    word_text = fields.Char("account.invoice_extract.word_text", help="Text of the extracted word")
    word_page = fields.Integer("account.invoice_extract.page")
    word_box_left = fields.Float("account.invoice_extract.word_box_left")
    word_box_right = fields.Float("account.invoice_extract.word_box_right")
    word_box_top = fields.Float("account.invoice_extract.word_box_top")
    word_box_bottom = fields.Float("account.invoice_extract.word_box_bottom")
    

class AccountInvoice(models.Model):

    _name = "account.invoice"
    _inherit = ['account.invoice']

    def _compute_can_show_send_resend(self, record):
        can_show = True
        if self.env.user.company_id.show_ocr_option_selection == 'no_send':
            can_show = False
        if record.state not in 'draft':
            can_show = False
        if record.type in ["out_invoice", "out_refund"]:
            can_show = False
        if record.message_main_attachment_id == None:
            can_show = False
        return can_show

    @api.depends('state', 'ocr_extract_data_state', 'message_ids')
    def _compute_show_resend_button(self):
        for record in self:
            record.can_show_resend_button = self._compute_can_show_send_resend(record)
            if record.ocr_extract_data_state not in ['error_status', 'not_enough_credit', 'module_not_up_to_date']:
                record.can_show_resend_button = False

    @api.depends('state', 'ocr_extract_data_state', 'message_ids')
    def _compute_show_send_button(self):
        for record in self:
            record.can_show_send_button = self._compute_can_show_send_resend(record)
            if record.ocr_extract_data_state not in ['no_extract_requested']:
                record.can_show_send_button = False

    ocr_extract_data_state = fields.Selection([('no_extract_requested', 'No extract requested'),
                            ('not_enough_credit', 'Not enough credit'),
                            ('error_status', 'An error occured'),
                            ('module_not_up_to_date', 'Module not up-to-date'),
                            ('extract_requested', 'Extraction requested'), 
                            ('waiting_extraction', 'Waiting extraction'), 
                            ('extract_not_ready', 'waiting extraction, but it is not ready'),
                            ('waiting_validation', 'Waiting validation'),
                            ('completed_flow', 'Completed flow')],
                            'Extract state', default='no_extract_requested', required=True)
    ocr_extract_data_id = fields.Integer("account.invoice.ocr_extract_data_id", default="-1", help="Invoice extract id")
    ocr_extract_data_word_ids = fields.One2many("account.invoice.extraction_words", inverse_name="invoice_id")

    ocr_invoice_id_user_change = fields.Boolean("ocr_invoice_id_changed", default=False)
    ocr_total_user_change = fields.Boolean("ocr_total_user_change", default=False)
    ocr_date_user_change = fields.Boolean("ocr_date_user_change", default=False)
    ocr_due_date_user_change = fields.Boolean("ocr_due_date_user_change", default=False)
    ocr_partner_user_change = fields.Boolean("ocr_partner_user_change", default=False)

    ocr_has_file = fields.Boolean("ocr_has_file", default=False)
    can_show_resend_button = fields.Boolean("Can show the ocr resend button", compute=_compute_show_resend_button)
    can_show_send_button = fields.Boolean("Can show the ocr send button", compute=_compute_show_send_button)

    @api.onchange('amount_total')
    def _ocr_onchange_amount_total(self):
        self.ocr_total_user_change = True

    @api.onchange('reference')
    def _ocr_onchange_reference(self):
        self.ocr_invoice_id_user_change = True

    @api.onchange('date_invoice')
    def _ocr_onchange_date_invoice(self):
        self.ocr_date_user_change = True
    
    @api.onchange('date_due')
    def _ocr_onchange_date_due(self):
        self.ocr_due_date_user_change = True
    
    @api.onchange('partner_id')
    def _ocr_onchange_partner_id(self):
        self.ocr_partner_user_change = True

    @api.multi
    @api.returns('mail.message', lambda value: value.id)
    def message_post(self, **kwargs):
        """When a message is posted on an account.invoice, send the attachment to iap-ocr if
        the res_config is on "auto_send" and if this is the first attachment."""
        if self.env.user.company_id.show_ocr_option_selection == 'auto_send':
            for record in self:
                if record.type in ["out_invoice", "out_refund"]:
                    return super(AccountInvoice, self).message_post(**kwargs)
                if record.message_main_attachment_id == None:
                    if "attachment_ids" in kwargs:
                        attachments = self.env["ir.attachment"].search([("id", "in", kwargs["attachment_ids"])])
                        if attachments.exists():
                            record.ocr_extract_data_state = 'extract_requested'
                            self.ocr_has_file = True
                            account_token = self.env['iap.account'].get('invoice_ocr')
                            endpoint = DEFAULT_ENDPOINT + '/iap/invoice_ocr/parse'
                            params = {
                                'account_token': account_token.account_token,
                                'version': CLIENT_OCR_VERSION,
                                'documents': [x.datas.decode('utf-8') for x in attachments], 
                                'file_names': [x.datas_fname for x in attachments],
                            }
                            try:
                                result = jsonrpc(endpoint, params=params)
                                if result[1] == "Not up-to-date":
                                    record.ocr_extract_data_state = 'module_not_up_to_date'
                                elif result[1] == "Not enough credits":
                                    record.ocr_extract_data_state = 'not_enough_credit'
                                elif result[0] == -1:
                                    record.ocr_extract_data_state = 'error_status'
                                else:
                                    record.ocr_extract_data_id = result[0]
                                    record.ocr_extract_data_state = 'waiting_extraction'
                            except AccessError:
                                record.ocr_extract_data_state = 'error_status'
        res = super(AccountInvoice, self).message_post(**kwargs)
        for record in self:
            record._compute_show_resend_button()
        return res

    def retry_ocr(self):
        """Retry to contact iap to submit the first attachment in the chatter"""
        if self.env.user.company_id.show_ocr_option_selection == 'no_send':
            return False
        attachments = self.message_main_attachment_id
        if attachments and attachments.exists() and self.ocr_extract_data_state in ['no_extract_requested', 'not_enough_credit', 'error_status', 'module_not_up_to_date']:
            self.ocr_extract_data_state = 'extract_requested'
            self.ocr_has_file = True
            account_token = self.env['iap.account'].get('invoice_ocr')
            endpoint = DEFAULT_ENDPOINT + '/iap/invoice_ocr/parse'
            params = {
                'account_token': account_token.account_token,
                'version': CLIENT_OCR_VERSION,
                'documents': [x.datas.decode('utf-8') for x in attachments], 
                'file_names': [x.datas_fname for x in attachments],
            }
            try:
                result = jsonrpc(endpoint, params=params)
                if result[1] == "Not up-to-date":
                    self.ocr_extract_data_state = 'module_not_up_to_date'
                elif result[1] == "Not enough credits":
                    self.ocr_extract_data_state = 'not_enough_credit'
                elif result[0] == -1:
                    self.ocr_extract_data_state = 'error_status'
                else:
                    self.ocr_extract_data_state = 'waiting_extraction'
                    self.ocr_extract_data_id = result[0]
            except AccessError:
                self.ocr_extract_data_state = 'error_status'

    @api.multi
    def get_validation(self, field):
        """
        return the text or box corresponding to the choice of the user.
        If the user selected a box on the document, we return this box, 
        but if he entered the text of the field manually, we return only the text, as we 
        don't know which box is the right one (if it exists)
        """
        selected = self.env["account.invoice.extraction_words"].search([("invoice_id", "=", self.id), ("field", "=", field), ("user_selected", "=", True)])
        if not selected.exists():
            selected = self.env["account.invoice.extraction_words"].search([("invoice_id", "=", self.id), ("field", "=", field), ("ocr_selected", "=", True)])
        return_box = []
        if selected.exists():
            return_box = ["box", selected.word_text, selected.word_page, selected.word_box_left, 
                selected.word_box_right, selected.word_box_top, selected.word_box_bottom]
        #now we have the user or ocr selection, check if there was manual changes
        must_send_manual_selection = False
        text_to_send = None
        if field == "total":
            must_send_manual_selection = self.ocr_total_user_change
            text_to_send = ["text", self.amount_total]
        elif field == "date":
            must_send_manual_selection = self.ocr_date_user_change
            text_to_send = ["text", str(self.date_invoice)]
        elif field == "due_date":
            must_send_manual_selection = self.ocr_due_date_user_change
            text_to_send = ["text", str(self.date_due)]
        elif field == "invoice_id":
            must_send_manual_selection = self.ocr_invoice_id_user_change
            text_to_send = ["text", self.reference]
        elif field == "partner":
            must_send_manual_selection = self.ocr_partner_user_change
            text_to_send = ["text", self.partner_id.name]
        elif field == "VAT_Number":
            must_send_manual_selection = self.ocr_partner_user_change
            text_to_send = ["text", self.partner_id.vat]
        else:
            return None
        
        if must_send_manual_selection:
            return text_to_send
        else:
            return return_box

    @api.multi
    def invoice_validate(self):
        """On the validation of an invoice, send the differents corrected fields to iap to improve
        the ocr algorithm"""
        super(AccountInvoice, self).invoice_validate()
        for record in self:
            if record.type in ["out_invoice", "out_refund"]:
                return
            if record.ocr_extract_data_state == 'waiting_validation':
                endpoint = DEFAULT_ENDPOINT + '/iap/invoice_ocr/validate'
                values = {
                    'total': record.get_validation('total'),
                    'date': record.get_validation('date'),
                    'due_date': record.get_validation('due_date'),
                    'invoice_id': record.get_validation('invoice_id'),
                    'partner': record.get_validation('partner'),
                    'VAT_Number': record.get_validation('VAT_Number')
                }
                params = {
                    'version': CLIENT_OCR_VERSION,
                    'document_id': record.ocr_extract_data_id, 
                    'values': values
                }
                try:
                    result = jsonrpc(endpoint, params=params)
                    if result == "Not up-to-date":
                        record.ocr_extract_data_state = 'module_not_up_to_date'
                    else:
                        record.ocr_extract_data_state = 'completed_flow'
                except AccessError:
                    pass

    @api.multi
    def get_boxes(self):
        return [{
            "id": data.id,
            "feature": data.field, 
            "text": data.word_text, 
            "ocr_selected": data.ocr_selected, 
            "user_selected": data.user_selected,
            "page": data.word_page,
            "box_left": data.word_box_left, 
            "box_right": data.word_box_right, 
            "box_top": data.word_box_top, 
            "box_bottom": data.word_box_bottom} for data in self.ocr_extract_data_word_ids]

    @api.multi
    def set_user_selected_box(self, id, edit_mode=False):
        """Set the selected box for a feature. The id of the box indicates the concerned feature.
        The method returns the text that can be set in the view (possibly different of the text in the file)"""
        self.ensure_one()
        word = self.env["account.invoice.extraction_words"].browse(int(id))
        to_unselect = self.env["account.invoice.extraction_words"].search([("invoice_id", "=", self.id), ("field", "=", word.field), ("user_selected", "=", True)])
        for box in to_unselect:
            box.user_selected = False
        word.user_selected = True
        if not edit_mode:
            self.set_field_with_text(word.field, word.word_text)
        if word.field == "total":
            self.ocr_total_user_change = False
            return {
                "line_id": self.invoice_line_ids[0].id if len(self.invoice_line_ids) == 1 else -1,
                "total": word.word_text,
            }
        if word.field == "date":
            self.ocr_date_user_change = False
        if word.field == "due_date":
            self.ocr_due_date_user_change = False
        if word.field == "invoice_id":
            self.ocr_invoice_id_user_change = False
        #if "currency" in result:
        #    box.amount_total = box.word_text
        #if "taxes" in result:
        #    box.amount_total = box.word_text
        if word.field == "VAT_Number":
            field_name = 'partner'
            self.ocr_partner_user_change = False
            partner_vat = self.env["res.partner"].search([("vat", "=", word.word_text.replace(" ", ""))], limit=1)
            if partner_vat.exists():
                return partner_vat.id
        if word.field == "supplier":
            self.ocr_partner_user_change = False
            partner_names = self.env["res.partner"].search([("name", "ilike", word.word_text)])
            if partner_names.exists():
                partner = min(partner_names, key=len)
                return partner.id
        return word.word_text.strip()

    @api.multi
    def _set_vat(self, text):
        partner_vat = self.env["res.partner"].search([("vat", "=", text.replace(" ", ""))], limit=1)
        if partner_vat.exists():
            self.partner_id = partner_vat
            return True
        return False

    @api.multi
    def set_field_with_text(self, field, text):
        """change a field with the data present in the text parameter"""
        self.ensure_one()
        if field == "total" and not self.ocr_total_user_change:
            if len(self.invoice_line_ids) == 1:
                self.invoice_line_ids[0].price_unit = to_float(text)
                self.invoice_line_ids[0].price_total = to_float(text)
            elif len(self.invoice_line_ids) == 0:
                self.invoice_line_ids.create({'name': "Invoice lines are not currently extracted from document",
                    'invoice_id': self.id,
                    'price_unit': to_float(text),
                    'price_total': to_float(text),
                    'quantity': 1,
                    'account_id': self.env["account.account"].search([(1, '=', 1)], limit=1).id,
                    })
        if field == "date" and not self.ocr_date_user_change:
            self.date_invoice = text
        if field == "due_date" and not self.ocr_due_date_user_change:
            self.date_due = text
        if field == "invoice_id" and not self.ocr_invoice_id_user_change:
            self.reference = text.strip()
        #partner
        partner_found = False
        if field == "VAT_Number" and not self.ocr_partner_user_change:
            partner_vat = self.env["res.partner"].search([("vat", "=", text.replace(" ", ""))], limit=1)
            if partner_vat.exists():
                self.partner_id = partner_vat
                partner_found = True
        if not partner_found and field == "supplier" and not self.ocr_partner_user_change:
            partner_names = self.env["res.partner"].search([("name", "ilike", text)])
            if partner_names.exists():
                partner = min(partner_names, key=len)
                self.partner_id = partner


    # @api.multi
    # def set_fields(self):
    #     self.ensure_one()
    #     user_selected_found = []
    #     for box in self.ocr_extract_data_word_ids:
    #         if box.user_selected:
    #             user_selected_found.append(box.field)
    #             self.set_field_with_text(box.field, box.word_text)
    #         elif box.field not in user_selected_found and box.ocr_selected:
    #             self.set_field_with_text(box.field, box.word_text)


    @api.multi
    def check_status(self):
        """contact iap to get the actual status of the ocr request"""
        for record in self:
            if record.ocr_extract_data_state in ["error_status"]:
                continue
            endpoint = DEFAULT_ENDPOINT + '/iap/invoice_ocr/get_result'
            params = {
                'version': CLIENT_OCR_VERSION,
                'document_id': record.ocr_extract_data_id
            }
            result = jsonrpc(endpoint, params=params)
            if result == "Not ready":
                record.ocr_extract_data_state = "extract_not_ready"
            elif result == "An error occured":
                record.ocr_extract_data_state = "error_status"
            else:
                record.ocr_extract_data_state = "waiting_validation"
                self.ocr_invoice_id_user_change = False
                self.ocr_total_user_change = False
                self.ocr_date_user_change = False
                self.ocr_due_date_user_change = False
                self.ocr_partner_user_change = False
                self.ocr_extract_data_word_ids.unlink()
                for feature, value in result.items():
                    self.set_field_with_text(feature, value["selected_text"][0])
                    for word in value["words"]:
                        self.ocr_extract_data_word_ids.create({
                            "invoice_id": self.id,
                            "field": feature,
                            "ocr_selected":value["selected_text"] == word,
                            "word_text": word[0],
                            "word_page": word[1],
                            "word_box_left": word[2][0][0],
                            "word_box_right": word[2][1][0],
                            "word_box_top": word[2][0][1],
                            "word_box_bottom": word[2][1][1]
                        })

    @api.multi
    def buy_credits(self):
        url = self.env['iap.account'].get_credits_url(base_url='', service_name='invoice_ocr')
        return {
            'type': 'ir.actions.act_url',
            'url': url,
        }
