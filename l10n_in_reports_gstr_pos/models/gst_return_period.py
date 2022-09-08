# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models



class L10nInReportAccount(models.Model):
    _inherit = "l10n_in.gst.return.period"

    # ===============================
    # GSTR-1
    # ===============================

    def _get_gstr1_hsn_json(self, journal_items, tax_details_by_move):
        """
            We need to show all saled product by product hsn code and journal items for POS is grouped by tax and sign
            So here grouped journal items is matched with pos order line and create ratio and get amount by product
            Here pos order line is group by product hsn code and product unit code and gst tax rate
            POS Session Journal Items:
                          Label                       | debit     | credit | tag ids |
            ==========================================|===========|========|=========|
            Sales with SGST Sale 2.5%, CGST Sale 2.5% | 10,200.00 | 0.0    |         |
            SGST sale 2.5%                            |    255.00 | 0.0    | +SGST   |
            CGST sale 2.5%                            |    255.00 | 0.0    | +CGST   |
            POS Order Lines:
            Product name | Product HSN | tax_ids | amount    |
            =============|=============|=========|===========|
            Mobile       | 8517        | GST 5%  | 10,000.00 |
            Mobile cover | 3919        | GST 5%  |    200.00 |
            in this case ratio for first line is 0.98(~) and for second line 0.0196(~)
            In this hsn json as below
            [{
                "hsn_sc": "8517",
                "uqc": "UNT",
                "rt": 5.0,
                "qty": 1.0,
                "txval": 10000.0,
                "iamt": 0.0,
                "samt": 250.0, (255.00 * (10000.0/10200.00))
                "camt": 250.0, (255.00 * (10000.0/10200.00))
                "csamt": 0.0
            },
            {
                "hsn_sc": "3919",
                "uqc": "UNT",
                "rt": 5.0,
                "qty": 1.0,
                "txval": 200.0,
                "iamt": 0.0,
                "samt": 5.0, (255.00 * (200.0/10200.00))
                "camt": 5.0, (255.00 * (200.0/10200.00))
                "csamt": 0.0
            }]
        """
        def _is_pos_order_line_matched_account_move_line(account_move_line, pos_order_line):
            income_account = pos_order_line.product_id.with_company(pos_order_line.company_id)._get_product_accounts()["income"]
            if pos_order_line.order_id.fiscal_position_id:
                income_account = pos_order_line.order_id.fiscal_position_id.map_account(income_account)
            return income_account == account_move_line.account_id \
                and (account_move_line.credit > 0.00 and pos_order_line.price_subtotal > 0.00) \
                or (account_move_line.debit > 0.00 and pos_order_line.price_subtotal < 0.00) \
                and pos_order_line.tax_ids_after_fiscal_position.flatten_taxes_hierarchy() == account_move_line.tax_ids

        pos_journal_items = journal_items.filtered(lambda l: l.move_id.l10n_in_pos_session_ids and l.move_id.move_type == "entry")
        hsn_json = super()._get_gstr1_hsn_json(journal_items-pos_journal_items, tax_details_by_move)
        for move_id in pos_journal_items.mapped("move_id"):
            tax_details = tax_details_by_move.get(move_id)
            for line, line_tax_details in tax_details.items():
                tax_rate = line_tax_details['gst_tax_rate']
                if tax_rate.is_integer():
                    tax_rate = int(tax_rate)
                for pos_order_line in move_id.l10n_in_pos_session_ids.order_ids.lines:
                    if _is_pos_order_line_matched_account_move_line(line, pos_order_line):
                        price_subtotal = pos_order_line.price_subtotal * pos_order_line.order_id.currency_rate
                        pos_ratio = abs(price_subtotal/line.balance)
                        product_uom_code = pos_order_line.product_uom_id.l10n_in_code \
                            and pos_order_line.product_uom_id.l10n_in_code.split("-")[0] or "OTH"
                        product_hsn_code = self.env["account.edi.format"]._l10n_in_edi_extract_digits(pos_order_line.product_id.l10n_in_hsn_code)
                        group_key = "%s-%s-%s"%(
                            tax_rate, product_hsn_code, product_uom_code)
                        hsn_json.setdefault(group_key, {
                            "hsn_sc": product_hsn_code,
                            "uqc": product_uom_code,
                            "rt": tax_rate,
                            "qty": 0.00, "txval": 0.00, "iamt": 0.00, "samt": 0.00, "camt": 0.00, "csamt": 0.00})
                        hsn_json[group_key]['txval'] += line_tax_details.get('base_amount_currency', 0.00) * pos_ratio * -1
                        hsn_json[group_key]['iamt'] += line_tax_details.get('igst', 0.00) * pos_ratio * -1
                        hsn_json[group_key]['samt'] += line_tax_details.get('cgst', 0.00) * pos_ratio * -1
                        hsn_json[group_key]['camt'] += line_tax_details.get('sgst', 0.00) * pos_ratio * -1
                        hsn_json[group_key]['csamt'] += line_tax_details.get('cess', 0.00) * pos_ratio *-1
        return hsn_json

    def _get_section_domain(self, section_code):
        domain = super()._get_section_domain(section_code)
        if section_code == "b2cs":
            domain.remove(("move_id.move_type", "in", ["out_invoice", "out_refund"]))
            domain.remove(("move_id.l10n_in_gst_treatment", "in", ("unregistered", "consumer", "composition")))
            domain += ["|",
            "&", ("move_id.move_type", "in", ["out_invoice", "out_refund"]),
                ("move_id.l10n_in_gst_treatment", "in", ("unregistered", "consumer", "composition")),
            "&", ("move_id.move_type", "=", "entry"),
                ("move_id.l10n_in_pos_session_ids", "!=", False)
            ]
        if section_code == "nil":
            domain.remove(("move_id.move_type", "in", ["out_invoice", "out_refund"]))
            domain += ["|", "&",
                ("move_id.move_type", "=", "entry"),
                ("move_id.l10n_in_pos_session_ids", "!=", False),
                ("move_id.move_type", "in", ["out_invoice", "out_refund"]),
            ]
        if section_code == "hsn":
            domain.remove(("move_id.move_type", "in", ["out_invoice", "out_refund"]))
            domain += ["|", "&",
                ("move_id.move_type", "=", "entry"),
                ("move_id.l10n_in_pos_session_ids", "!=", False),
                ("move_id.move_type", "in", ["out_invoice", "out_refund"]),
            ]
        return domain
