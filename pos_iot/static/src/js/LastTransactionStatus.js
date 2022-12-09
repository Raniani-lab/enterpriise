/** @odoo-module */
import core from "web.core";
import AbstractAwaitablePopup from "@point_of_sale/js/Popups/AbstractAwaitablePopup";
import PosComponent from "@point_of_sale/js/PosComponent";
import Registries from "@point_of_sale/js/Registries";
import { Gui } from "@point_of_sale/js/Gui";

const { useState } = owl;
const _t = core._t;

/**
 * Last Transaction Status Button
 *
 * Retrieve the status of the last transaction processed by the connected
 * Worldline payment terminal and opens a popup to display the result.
 */
export class LastTransactionStatusButton extends PosComponent {
    setup() {
        this.state = useState({ pending: false });
    }

    sendLastTransactionStatus() {
        if (this.state.pending) {
            return;
        }

        if (
            this.env.pos.get_order() &&
            this.env.pos.get_order().selected_paymentline &&
            ["waiting", "waitingCard", "waitingCancel"].includes(
                this.env.pos.get_order().selected_paymentline.payment_status
            )
        ) {
            Gui.showPopup("ErrorPopup", {
                title: _t("Electronic payment in progress"),
                body: _t(
                    "You cannot check the status of the last transaction when a payment in in progress."
                ),
            });
            return;
        }

        this.state.pending = true;
        this.env.pos.payment_methods.map((pm) => {
            if (pm.use_payment_terminal == "worldline") {
                var terminal = pm.payment_terminal.get_terminal();
                terminal.add_listener(this._onLastTransactionStatus.bind(this));
                terminal.action({ messageType: "LastTransactionStatus" }).catch(() => {
                    this.state.pending = false;
                });
            }
        });
    }

    _onLastTransactionStatus(data) {
        this.state.pending = false;
        Gui.showPopup("LastTransactionPopup", data.value);
    }
}
LastTransactionStatusButton.template = "LastTransactionStatusButton";
Registries.Component.add(LastTransactionStatusButton);

/**
 * Last Transaction Popup
 *
 * Displays the result of the last transaction processed by the connected
 * Worldline payment terminal
 */
export class LastTransactionPopup extends AbstractAwaitablePopup {}
LastTransactionPopup.template = "LastTransactionPopup";
LastTransactionPopup.defaultProps = { cancelKey: false };
Registries.Component.add(LastTransactionPopup);
