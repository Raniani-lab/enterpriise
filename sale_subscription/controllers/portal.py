# -*- coding: utf-8 -*-
import datetime
import werkzeug
from collections import OrderedDict
from dateutil.relativedelta import relativedelta
from math import ceil
from werkzeug.urls import url_encode

from odoo import http, fields
from odoo.exceptions import AccessError, MissingError
from odoo.fields import Command
from odoo.http import request
from odoo.tools.translate import _
from odoo.addons.payment.controllers import portal as payment_portal
from odoo.addons.payment import utils as payment_utils
from odoo.addons.portal.controllers.portal import pager as portal_pager
from odoo.addons.sale.controllers import portal as sale_portal
from odoo.addons.sale_subscription.models.sale_order import SUBSCRIPTION_PROGRESS_STATE

class CustomerPortal(payment_portal.PaymentPortal):

    def _get_subscription_domain(self, partner):
        return [
            ('partner_id', 'in', [partner.id, partner.commercial_partner_id.id]),
            ('subscription_state', 'in', ['3_progress', '4_paused', '6_churn']),
            ('is_subscription', '=', True)
        ]

    def _prepare_home_portal_values(self, counters):
        """ Add subscription details to main account page """
        values = super()._prepare_home_portal_values(counters)
        if 'subscription_count' in counters:
            if request.env['sale.order'].check_access_rights('read', raise_exception=False):
                partner = request.env.user.partner_id
                values['subscription_count'] = request.env['sale.order'].search_count(self._get_subscription_domain(partner))
            else:
                values['subscription_count'] = 0
        return values

    def _get_subscription(self, access_token, order_id):
        logged_in = not request.env.user.sudo()._is_public()
        order_sudo = request.env['sale.order']
        try:
            order_sudo = self._document_check_access('sale.order', order_id, access_token)
        except AccessError:
            if not logged_in:
                subscription_url = '/my/subscription/%d' % order_id
                return order_sudo, werkzeug.utils.redirect('/web/login?redirect=%s' % werkzeug.urls.url_quote(subscription_url))
            else:
                raise werkzeug.exceptions.NotFound()
        except MissingError:
            return order_sudo, request.redirect('/my')
        return order_sudo, None

    @http.route(['/my/subscription', '/my/subscription/page/<int:page>'], type='http', auth="user", website=True)
    def my_subscription(self, page=1, date_begin=None, date_end=None, sortby=None, filterby=None, **kw):
        values = self._prepare_portal_layout_values()
        partner = request.env.user.partner_id
        Order = request.env['sale.order']

        domain = self._get_subscription_domain(partner)

        if date_begin and date_end:
            domain += [('create_date', '>', date_begin), ('create_date', '<=', date_end)]

        searchbar_sortings = {
            'date': {'label': _('Newest'), 'order': 'create_date desc, id desc'},
            'name': {'label': _('Name'), 'order': 'name asc, id asc'},
            'subscription_state': {'label': _('Status'), 'order': 'subscription_state asc, id desc'}
        }
        searchbar_filters = {
            'all': {'label': _('All'), 'domain': []},
            'open': {'label': _('In Progress'), 'domain': [('subscription_state', 'in', ['3_progress', '4_paused'])]},
            'to_renew': {'label': _('To Renew'), 'domain': [('subscription_state', '=', '3_progress'), ('next_invoice_date', '<', fields.Date.today())]},
            'close': {'label': _('Closed'), 'domain': [('subscription_state', '=', '6_churn')]},
        }

        # default sort by value
        if not sortby:
            sortby = 'subscription_state'
        order = searchbar_sortings[sortby]['order']
        # default filter by value
        if not filterby:
            filterby = 'all'
        domain += searchbar_filters[filterby]['domain']

        # pager
        order_count = Order.search_count(domain)
        pager = portal_pager(
            url="/my/subscription",
            url_args={'date_begin': date_begin, 'date_end': date_end, 'sortby': sortby, 'filterby': filterby},
            total=order_count,
            page=page,
            step=self._items_per_page
        )
        orders = Order.search(domain, order=order, limit=self._items_per_page, offset=pager['offset'])
        request.session['my_subscriptions_history'] = orders.ids[:100]

        values.update({
            'subscriptions': orders,
            'page_name': 'subscription',
            'pager': pager,
            'default_url': '/my/subscription',
            'searchbar_sortings': searchbar_sortings,
            'sortby': sortby,
            'searchbar_filters': OrderedDict(sorted(searchbar_filters.items())),
            'filterby': filterby,
        })
        return request.render("sale_subscription.portal_my_subscriptions", values)

    @http.route(['/my/subscription/<int:order_id>', '/my/subscription/<int:order_id>/<access_token>'],
                type='http', auth='public', website=True)
    def subscription(self, order_id, access_token=None, message='', message_class='', report_type=None, download=False, **kw):
        order_sudo, redirection = self._get_subscription(access_token, order_id)
        if redirection:
            return redirection
        if report_type in ('html', 'pdf', 'text'):
            return self._show_report(model=order_sudo, report_type=report_type, report_ref='sale.action_report_saleorder', download=download)

        enable_token_management = request.env.user.partner_id in (order_sudo.partner_id.child_ids | order_sudo.partner_id)
        display_close = order_sudo.plan_id.sudo().user_closable and order_sudo.subscription_state == '3_progress'
        is_follower = request.env.user.partner_id in order_sudo.message_follower_ids.partner_id
        if order_sudo.pending_transaction and not message:
            message = _("This subscription has a pending payment transaction.")
            message_class = 'alert-warning'
        periods = {'week': 'weeks', 'month': 'months', 'year': 'years'}
        # Calculate the duration when the customer can reopen his subscription
        missing_periods = 1
        if order_sudo.next_invoice_date:
            rel_period = relativedelta(datetime.datetime.today(), order_sudo.next_invoice_date)
            missing_periods = ceil(getattr(rel_period, periods[order_sudo.plan_id.billing_period_unit])/order_sudo.plan_id.billing_period_value)//1
        action = request.env.ref('sale_subscription.sale_subscription_action')
        token_management_url_params = {
            'manage_subscription': True,
            'sale_order_id': order_id,
            'access_token': access_token,
        }
        progress_child = order_sudo.subscription_child_ids.filtered(lambda s: s.subscription_state in SUBSCRIPTION_PROGRESS_STATE)
        # prevent churned SO with a confirmed renewal to be reactivated. The child should be updated.
        display_payment_message = order_sudo.subscription_state in ['3_progress', '4_paused', '6_churn'] and not progress_child
        portal_page_values = {
            'page_name': 'subscription',
            'subscription': order_sudo,
            'template': order_sudo.sale_order_template_id.sudo(),
            'display_close': display_close,
            'is_follower': is_follower,
            'close_reasons': request.env['sale.order.close.reason'].search([]),
            'missing_periods': missing_periods,
            'user': request.env.user,
            'is_salesman': request.env.user.has_group('sales_team.group_sale_salesman'),
            'action': action,
            'message': message,
            'message_class': message_class,
            'pricelist': order_sudo.pricelist_id.sudo(),
            'enable_token_management': enable_token_management,
            'token_management_url': f'/my/payment_method?{url_encode(token_management_url_params)}',
            'payment_action_id': request.env.ref('payment.action_payment_provider').id,
            'display_payment_message': display_payment_message,
        }
        portal_page_values = self._get_page_view_values(
            order_sudo, access_token, portal_page_values, 'my_subscriptions_history', False)

        payment_form_values = {
            'default_token_id': order_sudo.payment_token_id.id,
            'sale_order_id': order_sudo.id,  # Allow Stripe to check if tokenization is required.
        }

        payment_context = {
            # Used only for fetching the PMs with Stripe Elements; the final amount is determined by
            # the generated invoice.
            'amount': order_sudo.amount_total,
            'partner_id': order_sudo.partner_id.id,
        }

        rendering_context = {
            **SalePortal._get_payment_values(self, order_sudo, is_subscription=True),
            **portal_page_values,
            **payment_form_values,
            **payment_context,
        }
        return request.render("sale_subscription.subscription", rendering_context)

    @http.route(['/my/subscription/<int:order_id>/close'], type='http', methods=["POST"], auth="public", website=True)
    def close_account(self, order_id, access_token=None, **kw):
        order_sudo, redirection = self._get_subscription(access_token, order_id)
        if redirection:
            return redirection
        if order_sudo.plan_id.user_closable:
            close_reason = request.env['sale.order.close.reason'].browse(int(kw.get('close_reason_id')))
            if close_reason:
                if kw.get('closing_text'):
                    order_sudo.message_post(body=_('Closing text: %s', kw.get('closing_text')))
                order_sudo.set_close(close_reason_id=close_reason.id)
        return request.redirect(f'/my/subscription/{order_id}/{access_token}')


class PaymentPortal(payment_portal.PaymentPortal):

    def _get_extra_payment_form_values(
        self, manage_subscription=False, sale_order_id=None, access_token=None, **kwargs
    ):
        """ Override of `payment` to reroute the payment flow to the /my/payment_method page when
        managing tokens of the subscription.

        :param bool manage_subscription: Whether the payment form should be adapted to allow
                                         managing subscriptions. This allows distinguishing cases.
        :param str sale_order_id: The sale order for which a payment is made, as a `sale.order` id.
        :param str access_token: The access token of the subscription.
        :param dict kwargs: Locally unused keywords arguments.
        :return: The dict of extra payment form values.
        :rtype: dict
        """
        extra_payment_form_values = super()._get_extra_payment_form_values(
            manage_subscription=manage_subscription,
            sale_order_id=sale_order_id,
            access_token=access_token,
            **kwargs,
        )
        if sale_order_id:
            sale_order_id = self._cast_as_int(sale_order_id)
            if manage_subscription:
                order_sudo = self._document_check_access('sale.order', sale_order_id, access_token)
                extra_payment_form_values.update({
                    'subscription': order_sudo,
                    'allow_token_selection': True,
                    'allow_token_deletion': False,
                    'default_token_id': order_sudo.payment_token_id.id,
                    'transaction_route': order_sudo.get_portal_url(suffix='/transaction'),
                    'assign_token_route': f'/my/subscription/assign_token/{sale_order_id}',
                    'landing_route': order_sudo.get_portal_url() + '&' + url_encode({
                        'message': _("Your payment method has been changed for this subscription."),
                        'message_class': 'alert-success',
                    })
                })
        return extra_payment_form_values

    def _create_transaction(self, *args, **kwargs):
        """ Override of payment to set subscriptions in pending states.

        :param int sale_order_id: The sale order for which a payment id made, as a `sale.order` id
        :param dict custom_create_values: Additional create values overwriting the default ones
        :return: The result of the parent method
        :rtype: recordset of `payment.transaction`
        """
        tx_sudo = super()._create_transaction(
            *args, **kwargs
        )
        subscriptions = tx_sudo.sale_order_ids.filtered('is_subscription')
        subscriptions.pending_transaction = True
        return tx_sudo


    @http.route('/my/subscription/<int:order_id>/transaction', type='json', auth='public')
    def subscription_transaction(
        self, order_id, access_token, is_validation=False, **kwargs
    ):
        """ Create a draft transaction and return its processing values.
        :param int order_id: The subscription for which a transaction is made, as a `sale.order` id
        :param str access_token: The access token of the subscription used to authenticate the partner
        :param bool is_validation: Whether the operation is a validation
        :param dict kwargs: Locally unused data passed to `_create_transaction`
        :return: The mandatory values for the processing of the transaction
        :rtype: dict
        :raise: ValidationError if the subscription id or the access token is invalid
        """
        order_sudo, redirection = self._get_subscription(access_token, order_id)
        if redirection:
            return redirection
        logged_in = not request.env.user._is_public()
        partner_sudo = request.env.user.partner_id if logged_in else order_sudo.partner_id
        self._validate_transaction_kwargs(kwargs)
        kwargs.update(partner_id=partner_sudo.id)
        if not is_validation:  # Renewal transaction
            unpaid_invoice_sudo = order_sudo.invoice_ids.filtered(
                lambda am: am.state == 'posted' and
                           am.move_type == 'out_invoice' and
                           am.payment_state not in ['paid', 'in_payment', 'reversed'])
            draft_invoice_sudo = order_sudo.invoice_ids.filtered(lambda am: am.state == 'draft' and
                                                                            am.move_type == 'out_invoice')
            invoice_sudo = unpaid_invoice_sudo or draft_invoice_sudo
            if not invoice_sudo:
                invoice_sudo = order_sudo.with_context(lang=partner_sudo.lang,) \
                    ._create_invoices(final=True)
            kwargs.update({
                'amount': invoice_sudo[:1].amount_total,
                'currency_id': order_sudo.currency_id.id,
                'tokenization_requested': True,  # Renewal transactions are always tokenized
            })
            # Create the transaction.
            tx_sudo = self._create_transaction(
                custom_create_values={
                    'sale_order_ids': [Command.set([order_id])],
                    'invoice_ids': [Command.set([invoice_sudo[:1].id])],
                    'subscription_action': 'assign_token',
                },
                is_validation=is_validation,
                **kwargs
            )
        else:  # Validation transaction
            kwargs.update({
                'amount': None,  # The amount is computed when creating the transaction.
                'currency_id': None,  # The currency is computed when creating the transaction.
                'reference_prefix': payment_utils.singularize_reference_prefix(
                    prefix='V'  # Validation transactions use their own reference prefix
                ),
            })
            tx_sudo = self._create_transaction(
                custom_create_values={
                    'sale_order_ids': [Command.set([order_id])],
                    'subscription_action': 'assign_token',
                },
                is_validation=is_validation,
                **kwargs
            )

        return tx_sudo._get_processing_values()

    @http.route('/my/subscription/assign_token/<int:order_id>', type='json', auth='user')
    def subscription_assign_token(self, order_id, token_id, access_token=None):
        """ Assign a token to a subscription.

        :param int order_id: The subscription to which the token must be assigned, as a
                                    `sale.order` id
        :param int token_id: The token to assign, as a `payment.token` id
        :param str access_token: the order portal access token
        :return: None
        """
        order_sudo, redirection = self._get_subscription(access_token, order_id)
        partner_id = request.env.user.partner_id

        if redirection:
            return redirection

        token_sudo = request.env['payment.token'].sudo().search([
            ('id', '=', token_id),
            ('partner_id', 'child_of', partner_id.commercial_partner_id.id),
            # Bypass active_test context to make sure no archived tokens are used.
            ('active', '=', True),
        ])

        if not token_sudo:
            # Archived token are removed from existing subscriptions
            # and shouldn't be re-assigned through this route.
            raise werkzeug.exceptions.NotFound()

        order_sudo.payment_token_id = token_sudo


class SalePortal(sale_portal.CustomerPortal):

    def _prepare_orders_domain(self, partner):
        domain = super()._prepare_orders_domain(partner)
        domain.append(('is_subscription', '=', False))
        return domain

    def _get_payment_values(self, order_sudo, is_subscription=False, **kwargs):
        """ Override of `sale` to specify whether the sales order is a subscription.

        :param sale.order order_sudo: The sales order being paid.
        :param bool is_subscription: Whether the order is a subscription.
        :param dict kwargs: Locally unused keywords arguments.
        :return: The payment-specific values.
        :rtype: dict
        """
        is_subscription = is_subscription \
                          or order_sudo.is_subscription \
                          or order_sudo.subscription_id.is_subscription
        return {
            **super()._get_payment_values(order_sudo, is_subscription=is_subscription, **kwargs),
            'is_subscription': is_subscription,
        }
