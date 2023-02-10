# Part of Odoo. See LICENSE file for full copyright and licensing details.
from stdnum.cl import rut

from odoo import _, tools, http
from odoo.addons.website_sale.controllers.main import WebsiteSale
from odoo.http import request


class L10nCLWebsiteSale(WebsiteSale):

    def _l10n_cl_is_extra_info_needed(self):
        order = request.website.sale_get_order()
        return order.company_id.country_code == 'CL' \
               and request.env['ir.config_parameter'].sudo().get_param('sale.automatic_invoice') == 'True'

    def _cart_values(self, **kw):
        # OVERRIDE: Add flag in cart template (step 10)
        res = super()._cart_values(**kw)
        res['l10n_cl_show_extra_info'] = self._l10n_cl_is_extra_info_needed()
        return res

    def _get_country_related_render_values(self, kw, render_values):
        # OVERRIDE: Add flag in address template (step 20)
        vals = super()._get_country_related_render_values(kw, render_values)
        vals['l10n_cl_show_extra_info'] = self._l10n_cl_is_extra_info_needed()
        return vals

    def checkout_values(self, **kw):
        # OVERRIDE: Add flag in checkout template (step 20, when address is filled)
        vals = super().checkout_values(**kw)
        vals['l10n_cl_show_extra_info'] = self._l10n_cl_is_extra_info_needed()
        return vals

    def _extra_info_values(self, **kw):
        # OVERRIDE: Add flag in extra info template (step 30)
        vals = super()._extra_info_values(**kw)
        vals['l10n_cl_show_extra_info'] = self._l10n_cl_is_extra_info_needed()
        return vals

    def _get_shop_payment_values(self, order, **kwargs):
        # OVERRIDE: Add flag in payment template (step 40)
        vals = super()._get_shop_payment_values(order, **kwargs)
        vals['l10n_cl_show_extra_info'] = self._l10n_cl_is_extra_info_needed()
        return vals

    @http.route()
    def address(self, **kw):
        if self._l10n_cl_is_extra_info_needed():
            kw['callback'] = "/shop/l10n_cl_invoicing_info"
        return super().address(**kw)

    @http.route()
    def checkout(self, **kw):
        if self._l10n_cl_is_extra_info_needed() and kw.get('express'):
            kw.pop('express')
        return super().checkout(**kw)

    def _checkout_invoice_info_form_empty(self, **kw):
        return [key for key, value in kw.items() if value.strip() == '']

    def _checkout_invoice_info_form_validate(self, order, **kw):
        errors = {}
        if kw.get('vat') and not rut.is_valid(kw.get('vat').strip()):
            errors['vat'] = _('The RUT %s is not valid', kw.get('vat'))
        if kw.get('l10n_cl_type_document') == 'invoice' and order.partner_id.country_id.code != 'CL':
            errors['cl'] = _('You need to be a resident of Chile in order to request an invoice')
        if kw.get('l10n_cl_dte_email', '') and not tools.single_email_re.match(kw.get('l10n_cl_dte_email')):
            errors['dte_email'] = _('Invalid DTE email! Please enter a valid email address.')
        return errors

    def _get_default_value_invoice_info(self, order, **kw):
        return {
            'l10n_cl_type_document': kw.get('l10n_cl_type_document', 'ticket'),
            'l10n_cl_activity_description': kw.get('l10n_cl_activity_description', order.partner_id.l10n_cl_activity_description),
            'l10n_cl_dte_email': kw.get('l10n_cl_dte_email', ''),
            'vat': kw.get('vat') or order.partner_id.vat,
        }

    def _l10n_cl_update_order(self, order, **kw):
        if kw.get('l10n_cl_type_document') == 'ticket':
            order.partner_invoice_id = request.env.ref('l10n_cl.par_cfa')
        if kw.get('l10n_cl_type_document') == 'invoice':
            order.partner_id.l10n_cl_sii_taxpayer_type = '1'
            order.partner_id.l10n_cl_activity_description = kw.get('l10n_cl_activity_description')
            order.partner_id.vat = kw.get('vat')
            order.partner_id.l10n_cl_dte_email = kw.get('l10n_cl_dte_email')

    @http.route(['/shop/l10n_cl_invoicing_info'], type='http', auth="public", methods=['GET', 'POST'], website=True, sitemap=False)
    def l10n_cl_invoicing_info(self, **kw):
        order = request.website.sale_get_order()
        values = {
            'website_sale_order': order,
            'l10n_cl_show_extra_info': True,
            'default_value': kw,
            'errors_fields': self._checkout_invoice_info_form_validate(order, **kw),
            'errors_empty': self._checkout_invoice_info_form_empty(**kw),
        }
        if request.httprequest.method == 'POST':
            if (values['errors_fields'] or values['errors_empty']) and kw['l10n_cl_type_document'] != 'ticket':
                return request.render("l10n_cl_edi_website_sale.l10n_cl_edi_invoicing_info", values)
            self._l10n_cl_update_order(order, **kw)
            return request.redirect("/shop/confirm_order")
        # httprequest.method GET
        if order.partner_id.country_id.code != 'CL':
            order.partner_invoice_id = request.env.ref('l10n_cl.par_cfa')
            return request.redirect("/shop/confirm_order")
        if 'l10n_cl_type_document' not in values['default_value']:
            values['default_value'].update(l10n_cl_type_document='ticket')
        return request.render('l10n_cl_edi_website_sale.l10n_cl_edi_invoicing_info', values)
