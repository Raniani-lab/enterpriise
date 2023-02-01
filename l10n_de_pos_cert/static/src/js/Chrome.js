/** @odoo-module */

import { Chrome } from "@point_of_sale/js/Chrome";
import { useListener } from "@web/core/utils/hooks";
import { patch } from "@web/core/utils/patch";
import { ConfirmPopup } from "@point_of_sale/js/Popups/ConfirmPopup";
import { ErrorPopup } from "@point_of_sale/js/Popups/ErrorPopup";
import { OfflineErrorPopup } from "@point_of_sale/js/Popups/OfflineErrorPopup";

patch(Chrome.prototype, "l10n_de_pos_cert.Chrome", {
    // @Override
    setup() {
        this._super(...arguments);
        useListener("fiskaly-error", this._fiskalyError);
        useListener("fiskaly-no-internet-confirm-popup", this._showFiskalyNoInternetConfirmPopup);
    },
    // @Override
    _errorHandler(error, errorToHandle) {
        if (errorToHandle.code === "fiskaly") {
            const message = {
                noInternet: this.env._t("Cannot sync the orders with Fiskaly !"),
                unknown: this.env._t(
                    "An unknown error has occurred ! Please contact Odoo for more information."
                ),
            };
            this.trigger("fiskaly-error", { error: errorToHandle, message });
        } else {
            this._super(...arguments);
        }
    },
    async _fiskalyError(event) {
        const error = event.detail.error;
        if (error.status === 0) {
            const title = this.env._t("No internet");
            const body = event.detail.message.noInternet;
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
            const title = this.env._t("Unknown error");
            const body = event.detail.message.unknown;
            await this.popup.add(ErrorPopup, { title, body });
        }
    },
    async _showUnauthorizedPopup() {
        const title = this.env._t("Unauthorized error to Fiskaly");
        const body = this.env._t(
            "It seems that your Fiskaly API key and/or secret are incorrect. Update them in your company settings."
        );
        await this.popup.add(ErrorPopup, { title, body });
    },
    async _showBadRequestPopup(data) {
        const title = this.env._t("Bad request");
        const body = _.str.sprintf(
            this.env._t("Your %s is incorrect. Update it in your PoS settings"),
            data
        );
        await this.popup.add(ErrorPopup, { title, body });
    },
    async _showFiskalyNoInternetConfirmPopup(event) {
        const { confirmed } = await this.popup.add(ConfirmPopup, {
            title: this.env._t("Problem with internet"),
            body: this.env._t(
                "You can either wait for the connection issue to be resolved or continue with a non-compliant receipt (the order will still be sent to Fiskaly once the connection issue is resolved).\n" +
                    "Do you want to continue with a non-compliant receipt ?"
            ),
        });
        if (confirmed) {
            event.detail();
        }
    },
});
