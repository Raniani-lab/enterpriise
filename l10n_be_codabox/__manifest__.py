# Part of Odoo. See LICENSE file for full copyright and licensing details.
{
    'name': 'Codabox',
    'version': '1.0',
    'author': 'Odoo',
    'category': 'Accounting/Localizations',
    'description': 'Codabox integration to retrieve your CODA and SODA files.',
    'depends': [
        'l10n_be_coda',
        'l10n_be_soda',
    ],
    'auto_install': True,
    'data': [
        'views/res_config_settings_views.xml',
        'views/account_journal_views.xml',
        'data/ir_cron.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'l10n_be_codabox/static/src/components/**/*',
        ],
    },
    'license': 'OEEL-1',
}
