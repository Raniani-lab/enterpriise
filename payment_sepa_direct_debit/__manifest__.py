# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': "Sepa Direct Debit Payment Acquirer",
    'version': '2.0',
    'category': 'Accounting/Accounting',
    'summary': "Payment Acquirer: Sepa Direct Debit",
    'description': """Sepa Direct Debit Payment Acquirer""",
    'depends': ['account_sepa_direct_debit', 'payment', 'sms'],
    'data': [
        'views/assets.xml',
        'views/payment_views.xml',
        'views/payment_sepa_direct_debit_templates.xml',
        'data/mail_template_data.xml',
        'data/payment_acquirer_data.xml',
    ],
    'installable': True,
    'post_init_hook': 'create_missing_journals',
    'uninstall_hook': 'uninstall_hook',
}
