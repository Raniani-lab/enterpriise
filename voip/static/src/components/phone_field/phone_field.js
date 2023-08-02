/** @odoo-module */

import { PhoneField } from "@web/views/fields/phone/phone_field";
import { patch } from "@web/core/utils/patch";
import { useService } from "@web/core/utils/hooks";

patch(PhoneField.prototype, {
    setup() {
        super.setup();
        if ("voip" in this.env.services) {
            // FIXME: this is only because otherwise @web tests would fail.
            // This is one of the major pitfalls of patching.
            this.voip = useService("voip");
        }
    },
    /**
     * Called when the phone number is clicked.
     *
     * @private
     * @param {MouseEvent} ev
     */
    async onLinkClicked(ev) {
        if (!this.voip) {
            return;
        }
        if (ev.target.matches("a")) {
            ev.stopImmediatePropagation();
        }
        if (!this.voip.canCall) {
            return;
        }
        ev.preventDefault();
        const { record, name } = this.props;
        this.voip.call({
            number: record.data[name],
            resModel: record.resModel,
            resId: record.resId,
        });
    },
});
