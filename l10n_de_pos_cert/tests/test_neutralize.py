from odoo.tests.common import tagged, TransactionCase


@tagged('post_install_l10n', 'post_install', '-at_install')
class TestL10nDEPosCertNeutralize(TransactionCase):
    def test_l10n_de_pos_cert_neutralize(self):
        company = self.env['res.company'].create({
            'name': 'Test DE Company',
            'l10n_de_fiskaly_api_key': 'Fake Fiskaly API key for tests',
            'l10n_de_fiskaly_api_secret': 'Fake Fisakly Secret for tests',
        })

        self.env['res.company']._neutralize()
        self.assertFalse(company.l10n_de_fiskaly_api_key)
        self.assertFalse(company.l10n_de_fiskaly_api_secret)
        self.assertFalse(company.l10n_de_fiskaly_organization_id)
