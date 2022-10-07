# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': "Sepa Direct Debit Payment Provider",
    'version': '2.0',
    'category': 'Accounting/Accounting',
    'summary': "Payment Provider: Sepa Direct Debit",
    'description': """Sepa Direct Debit Payment Provider""",
    'depends': ['account_sepa_direct_debit', 'account_payment', 'sms'],
    'data': [
        'views/payment_provider_views.xml',
        'views/payment_sepa_direct_debit_templates.xml',
        'views/sdd_mandate_views.xml',

        'data/mail_template_data.xml',
        'data/payment_provider_data.xml',
    ],
    'installable': True,
    'uninstall_hook': 'uninstall_hook',
    'assets': {
        'web.assets_common': [
            'payment_sepa_direct_debit/static/src/xml/signature_form.xml',
        ],
        'web.assets_frontend': [
            'payment_sepa_direct_debit/static/src/js/payment_form.js',
            'payment_sepa_direct_debit/static/src/js/signature_form.js',
            'payment_sepa_direct_debit/static/src/xml/signature_form.xml'
        ],
    },
    'license': 'OEEL-1',
}
