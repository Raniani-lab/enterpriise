# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import http, _
from odoo.exceptions import AccessError, MissingError
from odoo.http import request
from odoo.addons.portal.controllers import portal

import binascii


class CustomerPortal(portal.CustomerPortal):

    def _get_worksheet_data(self, task_sudo):
        # TO BE OVERRIDDEN
        return {}

    @http.route(['/my/task/<int:task_id>/worksheet',
                 '/my/task/<int:task_id>/worksheet/<string:source>'], type='http', auth="public", website=True)
    def portal_my_worksheet(self, task_id, access_token=None, source=False, report_type=None, download=False, message=False, **kw):

        try:
            task_sudo = self._document_check_access('project.task', task_id, access_token)
        except (AccessError, MissingError):
            return request.redirect('/my')

        if report_type in ('html', 'pdf', 'text'):
            return self._show_report(model=task_sudo, report_type=report_type, report_ref='industry_fsm.task_custom_report', download=download)
        data = self._get_worksheet_data(task_sudo)
        data.update({'task': task_sudo, 'message': message, 'source': source})

        return request.render("industry_fsm.portal_my_worksheet", data)


    @http.route(['/my/task/<int:task_id>/worksheet/sign/<string:source>'], type='json', auth="public", website=True)
    def portal_worksheet_sign(self, task_id, access_token=None, source=False, name=None, signature=None):
        # get from query string if not on json param
        access_token = access_token or request.httprequest.args.get('access_token')
        try:
            task_sudo = self._document_check_access('project.task', task_id, access_token=access_token)
        except (AccessError, MissingError):
            return {'error': _('Invalid Task.')}

        if not task_sudo.has_to_be_signed():
            return {'error': _('The worksheet is not in a state requiring customer signature.')}
        if not signature:
            return {'error': _('Signature is missing.')}

        try:
            task_sudo.write({
                'worksheet_signature': signature,
                'worksheet_signed_by': name,
            })
        except (TypeError, binascii.Error):
            return {'error': _('Invalid signature data.')}

        pdf = request.env.ref('industry_fsm.task_custom_report').sudo()._render_qweb_pdf([task_sudo.id])[0]
        task_sudo.message_post(body=_('The worksheet has been signed'), attachments=[('%s.pdf' % task_sudo.name, pdf)])
        query_string = '&message=sign_ok'
        return {
            'force_refresh': True,
            'redirect_url': task_sudo.get_portal_url(suffix='/worksheet/%s' % source, query_string=query_string),
        }
