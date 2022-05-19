# -*- coding: utf-8 -*-
from lxml import etree

from odoo import Command
from odoo.addons.account.tests.common import AccountTestInvoicingCommon
from odoo.tests import tagged, Form


class WizardForm(Form):
    """ Hack the current ORM form to emulate the bank reconciliation widget.
    Indeed, the current implementation doesn't work with the new record.
    """

    def __init__(self, recordp, view=None):
        # EXTENDS base
        # Prevent the trigger of the "editing unstored records is not supported" error.
        object.__setattr__(self, 'bankRecWidget', recordp)
        super().__init__(recordp.browse(), view=view)

    def _init_from_defaults(self, model):
        # EXTENDS base
        # Initialize the wizard with the default provided record.
        widget = self.bankRecWidget
        if widget:
            fields_info = self._view['fields']
            values = {
                fieldname: widget._fields[fieldname].convert_to_write(widget[fieldname], widget)
                for fieldname in fields_info.keys()
            }
            self._values.update(values)
        else:
            super()._init_from_defaults(model)

    def save(self):
        # EXTENDS base
        return self.bankRecWidget.new(self._values)


@tagged('post_install', '-at_install')
class TestBankRecWidgetCommon(AccountTestInvoicingCommon):

    @classmethod
    def setUpClass(cls, chart_template_ref=None):
        super().setUpClass(chart_template_ref=chart_template_ref)

        cls.currency_data_2 = cls.setup_multi_currency_data(default_values={
            'name': 'Dark Chocolate Coin',
            'symbol': '🍫',
            'currency_unit_label': 'Dark Choco',
            'currency_subunit_label': 'Dark Cacao Powder',
        }, rate2016=6.0, rate2017=4.0)
        cls.currency_data_3 = cls.setup_multi_currency_data(default_values={
            'name': 'Black Chocolate Coin',
            'symbol': '🍫',
            'currency_unit_label': 'Black Choco',
            'currency_subunit_label': 'Black Cacao Powder',
        }, rate2016=12.0, rate2017=8.0)

        # <field name="todo_command" invisible="1"/>
        # This test tests the onchange behvior of todo_command, `_onchange_todo_command`
        # But `todo_command` is always invisible in the view, and shouldn't be able to changed in the form by a user
        # The fact it gets changed is thanks to a custom js widget changing the value of the field even if invisible.
        view = cls.env.ref('account_accountant.view_bank_rec_widget_form')
        tree = etree.fromstring(view.arch)
        for node in tree.xpath('//field[@name="todo_command"]'):
            del node.attrib['invisible']
        view.arch = etree.tostring(tree)

    @classmethod
    def _create_invoice_line(cls, amount, partner, move_type, currency=None, pay_reference=None, ref=None, name=None, inv_date='2017-01-01'):
        ''' Create an invoice on the fly.'''
        invoice_form = Form(cls.env['account.move'].with_context(default_move_type=move_type, default_invoice_date=inv_date, default_date=inv_date))
        invoice_form.partner_id = partner
        if currency:
            invoice_form.currency_id = currency
        if pay_reference:
            invoice_form.payment_reference = pay_reference
        if ref:
            invoice_form.ref = ref
        if name:
            invoice_form.name = name
        with invoice_form.invoice_line_ids.new() as invoice_line_form:
            invoice_line_form.name = 'xxxx'
            invoice_line_form.quantity = 1
            invoice_line_form.price_unit = amount
            invoice_line_form.tax_ids.clear()
        invoice = invoice_form.save()
        invoice.action_post()
        lines = invoice.line_ids
        return lines.filtered(lambda l: l.account_id.account_type in ('asset_receivable', 'liability_payable'))

    @classmethod
    def _create_st_line(cls, amount, date='2019-01-01', payment_ref='turlututu', **kwargs):
        st = cls.env['account.bank.statement'].create({
            'name': '/',
            'journal_id': kwargs.get('journal_id', cls.company_data['default_journal_bank'].id),
            'line_ids': [Command.create({
                'amount': amount,
                'date': date,
                'payment_ref': payment_ref,
                **kwargs,
            })],
        })
        st.balance_end_real = st.balance_end
        st.button_post()
        return st.line_ids

    @classmethod
    def _create_reconcile_model(cls, **kwargs):
        return cls.env['account.reconcile.model'].create({
            'name': "test",
            'rule_type': 'invoice_matching',
            'allow_payment_tolerance': True,
            'payment_tolerance_type': 'percentage',
            'payment_tolerance_param': 0.0,
            **kwargs,
            'line_ids': [
                Command.create({
                    'account_id': cls.company_data['default_account_revenue'].id,
                    'amount_type': 'percentage',
                    'label': f"test {i}",
                    **line_vals,
                })
                for i, line_vals in enumerate(kwargs.get('line_ids', []))
            ],
        })
