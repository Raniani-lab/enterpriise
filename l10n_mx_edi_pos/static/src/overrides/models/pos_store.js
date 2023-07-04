/** @odoo-module */

import { PosStore } from "@point_of_sale/app/store/pos_store";
import { patch } from "@web/core/utils/patch";

patch(PosStore.prototype, "l10n_mx_edi_pos.PosStore", {
    //@override
    async _processData(loadedData) {
        await this._super(...arguments);
        if (this.company.country?.code === 'MX') {
            this.l10n_mx_edi_fiscal_regime = loadedData["l10n_mx_edi_fiscal_regime"];
            this.l10n_mx_country_id = loadedData["l10n_mx_country_id"];
            this.l10n_mx_edi_usage = loadedData["l10n_mx_edi_usage"];
        }
    },
});

