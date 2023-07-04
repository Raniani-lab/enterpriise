/** @odoo-module */

import { PosStore } from "@point_of_sale/app/store/pos_store";
import { Order } from "@point_of_sale/app/store/models";
import { patch } from "@web/core/utils/patch";

patch(PosStore.prototype, "l10n_cl_edi_pos.PosStore", {
    // @Override
    async _processData(loadedData) {
        await this._super(...arguments);
        if (this.isChileanCompany()) {
            this.l10n_latam_identification_types = loadedData["l10n_latam.identification.type"];
            this.sii_taxpayer_types = loadedData["sii_taxpayer_types"];
            this.consumidorFinalAnonimoId = loadedData["consumidor_final_anonimo_id"];
        }
    },
    isChileanCompany() {
        return this.company.country?.code == "CL";
    },
    doNotAllowRefundAndSales() {
        return this.isChileanCompany() || this._super(...arguments);
    },
});

patch(Order.prototype, "l10n_cl_edi_pos.Order", {
    setup() {
        this._super(...arguments);
        if (this.pos.isChileanCompany()) {
            this.to_invoice = true;
            this.invoiceType = "boleta";
            if (!this.partner) {
                this.partner = this.pos.db.partner_by_id[this.pos.consumidorFinalAnonimoId];
            }
            this.voucherNumber = false;
        }
    },
    export_as_JSON() {
        const json = this._super(...arguments);
        if (this.pos.isChileanCompany()) {
            json["invoiceType"] = this.invoiceType ? this.invoiceType : false;
            json["voucherNumber"] = this.voucherNumber;
        }
        return json;
    },
    init_from_JSON(json) {
        this._super(...arguments);
        this.voucherNumber = json.voucher_number || false;
    },
    is_to_invoice() {
        if (this.pos.isChileanCompany()) {
            return true;
        }
        return this._super(...arguments);
    },
    set_to_invoice(to_invoice) {
        if (this.pos.isChileanCompany()) {
            this.assert_editable();
            this.to_invoice = true;
        } else {
            this._super(...arguments);
        }
    },
    isFactura() {
        if (this.invoiceType == "boleta") {
            return false;
        }
        return true;
    },
});
