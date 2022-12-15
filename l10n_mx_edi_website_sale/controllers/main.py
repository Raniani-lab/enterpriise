# coding: utf-8
from odoo.addons.website_sale.controllers.main import WebsiteSale
from odoo.http import request
from odoo import http


class WebsiteSaleL10nMX(WebsiteSale):

    def _l10n_mx_edi_is_extra_info_needed(self):
        order = request.website.sale_get_order()
        return order.company_id.country_code == 'MX' \
               and request.env['ir.config_parameter'].sudo().get_param('sale.automatic_invoice') == 'True'

    def _cart_values(self, **kw):
        # OVERRIDE: Add flag in cart template (step 10)
        return {'l10n_mx_show_extra_info': self._l10n_mx_edi_is_extra_info_needed()}

    def _get_country_related_render_values(self, kw, render_values):
        # OVERRIDE: Add flag in address template (step 20)
        vals = super()._get_country_related_render_values(kw, render_values)
        vals['l10n_mx_show_extra_info'] = self._l10n_mx_edi_is_extra_info_needed()
        return vals

    def checkout_values(self, **kw):
        # OVERRIDE: Add flag in checkout template (step 20, when address is filled)
        vals = super().checkout_values(**kw)
        vals['l10n_mx_show_extra_info'] = self._l10n_mx_edi_is_extra_info_needed()
        return vals

    def _extra_info_values(self, **kw):
        # OVERRIDE: Add flag in extra info template (step 30)
        return {'l10n_mx_show_extra_info': self._l10n_mx_edi_is_extra_info_needed()}

    def _get_shop_payment_values(self, order, **kwargs):
        # OVERRIDE: Add flag in payment template (step 40)
        vals = super()._get_shop_payment_values(order, **kwargs)
        vals['l10n_mx_show_extra_info'] = self._l10n_mx_edi_is_extra_info_needed()
        return vals

    @http.route()
    def address(self, **kw):
        # Extends 'website_sale'
        # Redirect to '/shop/l10n_mx_invoicing_info' tab
        if self._l10n_mx_edi_is_extra_info_needed():
            kw['callback'] = "/shop/l10n_mx_invoicing_info"
        return super().address(**kw)

    @http.route()
    def checkout(self, **kw):
        # Extends 'website_sale'
        # Prevent express checkout
        if self._l10n_mx_edi_is_extra_info_needed() and kw.get('express'):
            kw.pop('express')
        return super().checkout(**kw)

    @http.route(['/shop/l10n_mx_invoicing_info'], type='http', auth="public", website=True, sitemap=False)
    def l10n_mx_invoicing_info(self, **kw):
        if not self._l10n_mx_edi_is_extra_info_needed():
            return request.redirect("/shop/confirm_order")

        order = request.website.sale_get_order()
        redirection = self.checkout_redirection(order)
        if redirection:
            return redirection

        l10n_mx_edi_fields = [
            request.env['ir.model.fields']._get('res.partner', 'l10n_mx_edi_fiscal_regime'),
            request.env['ir.model.fields']._get('account.move', 'l10n_mx_edi_usage'),
            request.env['ir.model.fields']._get('res.partner', 'l10n_mx_edi_no_tax_breakdown'),
        ]

        # === GET ===
        default_vals = {}
        if request.httprequest.method == 'GET':
            default_vals['need_invoice'] = not order.l10n_mx_edi_cfdi_to_public
            default_vals['l10n_mx_edi_fiscal_regime'] = order.partner_id.l10n_mx_edi_fiscal_regime
            default_vals['l10n_mx_edi_usage'] = order.l10n_mx_edi_usage
            default_vals['l10n_mx_edi_no_tax_breakdown'] = order.partner_id.l10n_mx_edi_no_tax_breakdown

        # === POST & possibly redirect ===
        if request.httprequest.method == 'POST':
            order.l10n_mx_edi_cfdi_to_public = kw.get('need_invoice') != '1'
            if kw.get('need_invoice') == '1':
                default_vals = {
                    'need_invoice': True,
                    'l10n_mx_edi_fiscal_regime': kw.get('l10n_mx_edi_fiscal_regime'),
                    'l10n_mx_edi_usage': kw.get('l10n_mx_edi_usage'),
                    'l10n_mx_edi_no_tax_breakdown': kw.get('l10n_mx_edi_no_tax_breakdown') == 'on',
                }
                if default_vals['l10n_mx_edi_fiscal_regime']:
                    order.partner_id.l10n_mx_edi_fiscal_regime = default_vals['l10n_mx_edi_fiscal_regime']
                if default_vals['l10n_mx_edi_usage']:
                    order.l10n_mx_edi_usage = default_vals['l10n_mx_edi_usage']
                order.partner_id.l10n_mx_edi_no_tax_breakdown = default_vals['l10n_mx_edi_no_tax_breakdown']
                if default_vals['l10n_mx_edi_fiscal_regime'] and default_vals['l10n_mx_edi_usage']:
                    return request.redirect("/shop/confirm_order")
            else:
                return request.redirect("/shop/confirm_order")

        # === Render extra_info tab ===
        values = {
            'request': request,
            'website_sale_order': order,
            'post': kw,
            'partner': order.partner_id.id,
            'order': order,
            'l10n_mx_edi_fields': l10n_mx_edi_fields,
            'company_country_code': order.company_id.country_id.code,
            'default_vals': default_vals,
            # flag for rendering the 'Extra Info' dot in the wizard_checkout
            'l10n_mx_show_extra_info': True,
        }
        return request.render("l10n_mx_edi_website_sale.l10n_mx_edi_invoicing_info", values)
