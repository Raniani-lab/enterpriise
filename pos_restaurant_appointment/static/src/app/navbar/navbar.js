/** @odoo-module */

import { Navbar } from "@point_of_sale/app/navbar/navbar";
import { patch } from "@web/core/utils/patch";

patch(Navbar.prototype, "pos_restaurant_appointment.Navbar", {
    manageBookings() {
        window.open("/web#action=appointment.appointment_type_action", "_blank");
    },
});
