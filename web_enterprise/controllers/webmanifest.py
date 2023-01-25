# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import json

from odoo import http
from odoo.http import request
from odoo.tools import ustr


class WebManifest(http.Controller):

    @http.route('/web/manifest.webmanifest', type='http', auth='public', methods=['GET'])
    def webmanifest(self):
        """ Returns a WebManifest describing the metadata associated with a web application.
        Using this metadata, user agents can provide developers with means to create user
        experiences that are more comparable to that of a native application.
        """
        web_app_name = request.env['ir.config_parameter'].sudo().get_param('web_enterprise.web_app_name', 'Odoo')
        manifest = {
            'name': web_app_name,
            'scope': '/web',
            'start_url': '/web',
            'display': 'standalone',
            'background_color': '#714B67',
            'theme_color': '#714B67',
            'prefer_related_applications': False,
        }
        icon_sizes = ['192x192', '512x512']
        manifest['icons'] = [{
            'src': '/web_enterprise/static/img/odoo-icon-%s.png' % size,
            'sizes': size,
            'type': 'image/png',
        } for size in icon_sizes]
        body = json.dumps(manifest, default=ustr)
        response = request.make_response(body, [
            ('Content-Type', 'application/manifest+json'),
        ])
        return response

    @http.route('/web/service-worker.js', type='http', auth='public', methods=['GET'])
    def service_worker(self):
        """ Returns a ServiceWorker javascript file scoped for the backend (aka. '/web')
        """
        body = """
            /**
            * PWA "installability" criteria requires to have a listener registered
            * for "fetch" events in the ServiceWorker, even an empty one.
            */
            self.addEventListener("fetch", () => {});
        """
        response = request.make_response(body, [
            ('Content-Type', 'text/javascript'),
            ('Service-Worker-Allowed', '/web'),
        ])
        return response
