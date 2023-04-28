/** @odoo-module */

import { PosStore } from "@point_of_sale/app/pos_store";
import { patch } from "@web/core/utils/patch";
import { ErrorPopup } from "@point_of_sale/js/Popups/ErrorPopup";
import { OfflineErrorPopup } from "@point_of_sale/js/Popups/OfflineErrorPopup";
import { ConfirmPopup } from "@point_of_sale/js/Popups/ConfirmPopup";
import { _t } from "@web/core/l10n/translation";
import { sprintf } from "@web/core/utils/strings";

patch(PosStore.prototype, "l10n_de_pos_cert.PosStore", {
    async fiskalyError(error, message) {
        if (error.status === 0) {
            const title = _t("No internet");
            const body = message.noInternet;
            await this.popup.add(OfflineErrorPopup, { title, body });
        } else if (error.status === 401 && error.source === "authenticate") {
            await this._showUnauthorizedPopup();
        } else if (
            (error.status === 400 && error.responseJSON.message.includes("tss_id")) ||
            (error.status === 404 && error.responseJSON.code === "E_TSS_NOT_FOUND")
        ) {
            await this._showBadRequestPopup("TSS ID");
        } else if (
            (error.status === 400 && error.responseJSON.message.includes("client_id")) ||
            (error.status === 400 && error.responseJSON.code === "E_CLIENT_NOT_FOUND")
        ) {
            // the api is actually sending an 400 error for a "Not found" error
            await this._showBadRequestPopup("Client ID");
        } else {
            const title = _t("Unknown error");
            const body = message.unknown;
            await this.popup.add(ErrorPopup, { title, body });
        }
    },
    async showFiskalyNoInternetConfirmPopup(event) {
        const { confirmed } = await this.popup.add(ConfirmPopup, {
            title: _t("Problem with internet"),
            body: _t(
                "You can either wait for the connection issue to be resolved or continue with a non-compliant receipt (the order will still be sent to Fiskaly once the connection issue is resolved).\n" +
                    "Do you want to continue with a non-compliant receipt?"
            ),
        });
        if (confirmed) {
            event.detail();
        }
    },
    async _showBadRequestPopup(data) {
        const title = _t("Bad request");
        const body = sprintf(_t("Your %s is incorrect. Update it in your PoS settings"), data);
        await this.popup.add(ErrorPopup, { title, body });
    },
    async _showUnauthorizedPopup() {
        const title = _t("Unauthorized error to Fiskaly");
        const body = _t(
            "It seems that your Fiskaly API key and/or secret are incorrect. Update them in your company settings."
        );
        await this.popup.add(ErrorPopup, { title, body });
    },
    async _showTaxError() {
        const rates = Object.keys(this.globalState.vatRateMapping);
        const title = _t("Tax error");
        let body;
        if (rates.length) {
            const ratesText = [rates.slice(0, -1).join(", "), rates.slice(-1)[0]].join(" and ");
            body = sprintf(
                _t("Product has an invalid tax amount. Only the following rates are allowed: %s."),
                ratesText
            );
        } else {
            body = _t(
                "There was an error while loading the Germany taxes. Try again later or your Fiskaly API key and secret might have been corrupted, request new ones"
            );
        }
        await this.popup.add(ErrorPopup, { title, body });
    },
});
