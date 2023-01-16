/** @odoo-module */

import { Navbar } from "@point_of_sale/app/navbar/navbar";
import { patch } from "@web/core/utils/patch";
import { LastTransactionStatusButton } from "../js/LastTransactionStatus";

patch(Navbar, "pos_iot.Navbar", {
    components: { ...Navbar.components, LastTransactionStatusButton },
});
