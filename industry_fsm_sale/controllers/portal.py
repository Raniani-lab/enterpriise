# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from werkzeug.exceptions import NotFound

from odoo.http import request, route

from odoo.addons.sale.controllers import portal
from odoo.addons.portal.controllers.portal import pager as portal_pager


class CustomerPortal(portal.CustomerPortal):

    @route([
        '/my/projects/<int:project_id>/task/<int:task_id>/quotes',
    ], type='http', auth='user', website=True)
    def portal_my_task_quotes(self, project_id=None, task_id=None, page=1, date_begin=None, date_end=None, sortby=None, **kw):
        task = request.env['project.task'].search([('project_id', '=', project_id), ('id', '=', task_id)])
        if not task.exists() or not task.project_id._check_project_sharing_access():
            return NotFound()
        values = self._prepare_portal_layout_values()
        SaleOrder = request.env['sale.order']
        searchbar_sortings = self._get_sale_searchbar_sortings()
        # default sortby order
        if not sortby:
            sortby = 'date'
        sort_order = searchbar_sortings[sortby]['order']
        domain = [('task_id', '=', task_id)]
        if date_begin and date_end:
            domain += [('create_date', '>', date_begin), ('create_date', '<=', date_end)]
        quotation_count = SaleOrder.search_count(domain)
        # pager
        pager = portal_pager(
            url="/my/quotes",
            url_args={'date_begin': date_begin, 'date_end': date_end, 'sortby': sortby},
            total=quotation_count,
            page=page,
            step=self._items_per_page
        )
        # content according to pager
        quotations = SaleOrder.search(domain, order=sort_order, limit=self._items_per_page, offset=pager['offset'])

        values.update({
            'date': date_begin,
            'quotations': quotations.sudo(),
            'page_name': 'quote',
            'pager': pager,
            'default_url': '/my/quotes',
            'searchbar_sortings': searchbar_sortings,
            'sortby': sortby,
        })
        return request.render('sale.portal_my_quotations', values)
