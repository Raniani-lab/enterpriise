odoo.define('voip.PhoneField', function (require) {
"use strict";

const basicFields = require('web.basic_fields');

const Phone = basicFields.FieldPhone;

/**
 * Override of FieldPhone to use the DialingPanel to perform calls on clicks.
 */
Phone.include({

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    async _hasPbxConfig() {
        const { voip } = await owl.Component.env.services.messaging.get();
        return (
            voip.mode !== "prod" ||
            voip.isServerConfigured &&
            voip.areCredentialsSet
        );
    },
    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * Called when the phone number is clicked.
     *
     * @private
     * @param {MouseEvent} ev
     */
    async _onClickLink(ev) {
        if (ev.target.matches("a")) {
            ev.stopImmediatePropagation();
        }
        if (this.mode !== 'readonly' || !window.RTCPeerConnection || !window.MediaStream || !navigator.mediaDevices) {
            return;
        }
        const canMadeVoipCall = await this._hasPbxConfig();
        if (canMadeVoipCall) {
            const messaging = await owl.Component.env.services.messaging.get();
            ev.preventDefault();
            messaging.env.services.voip.call({
                number: this.value,
                resId: this.res_id,
                resModel: this.model,
            });
        }
    },
});

});
