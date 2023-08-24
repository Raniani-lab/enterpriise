/** @odoo-module */

import { OfflineErrorPopup } from "@point_of_sale/app/errors/popups/offline_error_popup";
import { BasePrinter } from "@point_of_sale/app/printer/base_printer";
import { ReceiptScreen } from "@point_of_sale/app/screens/receipt_screen/receipt_screen";
import { _t } from "@web/core/l10n/translation";
import { patch } from "@web/core/utils/patch";

import { useState } from "@odoo/owl";

patch(ReceiptScreen.prototype, {
    setup() {
        super.setup(...arguments);
        const partner = this.currentOrder.get_partner();
        this.whatsappState = useState({
            inputWhatsapp: (partner && partner.mobile) || "",
            isSending: false,
            whatsappButtonDisabled: false,
            whatsappNotice: "",
            whatsappSuccessful: null,
        });
    },

    get is_valid_mobile() {
        const value = this.whatsappState.inputWhatsapp;
        if (value) {
            const valueLen = value.replace(/[^0-9]/g, "").length;
            return valueLen > 8 && valueLen < 15;
        }
        return false;
    },

    _updateWhatsappState(status, msg) {
        this.whatsappState.whatsappSuccessful = status;
        this.whatsappState.whatsappNotice = msg;
    },

    onInputWhatsapp(ev) {
        this.whatsappState.whatsappButtonDisabled = false;
        this.whatsappState.inputWhatsapp = ev.target.value;
    },

    async onSendWhatsapp() {
        if (this.whatsappState.isSending) {
            this._updateWhatsappState(false, _t("Sending in progress"));
            return;
        }
        this.whatsappState.isSending = true;
        this.whatsappState.whatsappNotice = "";

        if (!this.is_valid_mobile) {
            this._updateWhatsappState(false, _t("Invalid Number"));
            this.whatsappState.isSending = false;
            return;
        }

        // Delay to allow the user to see the wheel that informs that the whatsapp message will be sent
        setTimeout(async () => {
            try {
                await this._sendWhatsappReceiptToCustomer();
                this._updateWhatsappState(true, _t("WhatsApp sent"));
            } catch (error) {
                console.error(error);
                this._updateWhatsappState(
                    false,
                    _t("Something went wrong, please check the number and try again.")
                );
                this.whatsappState.whatsappButtonDisabled = true;
            }
            this.whatsappState.isSending = false;
        }, 1000);
    },

    async _sendWhatsappReceiptToCustomer() {
        const printer = new BasePrinter();
        const ticketImage = await printer.htmlToImg(this.orderReceipt.el.firstChild);
        const order = this.currentOrder;
        const partner = order.get_partner();
        const orderName = order.get_name();
        const orderPartner = {
            name: partner ? partner.name : this.whatsappState.inputWhatsapp,
            whatsapp: this.whatsappState.inputWhatsapp,
        };
        const orderServerId = this.pos.validated_orders_name_server_id_map[orderName];
        if (!orderServerId) {
            this.popup.add(OfflineErrorPopup, {
                title: _t("Unsynced order"),
                body: _t(
                    "This order is not yet synced to server. Make sure it is synced then try again."
                ),
            });
            return Promise.reject();
        }
        await this.orm.call("pos.order", "action_sent_receipt_on_whatsapp", [
            [orderServerId],
            orderName,
            orderPartner,
            ticketImage,
        ]);
    },
});
