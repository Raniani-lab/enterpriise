/** @odoo-module **/

import { registerPatch } from '@mail/model/model_core';

import { useBackButton } from 'web_mobile.hooks';

registerPatch({
    name: 'Dialog',
    componentSetup() {
        useBackButton(this.onBackButtonGlobal);
    },
    recordMethods: {
        /**
         * Handles the `backbutton` custom event. This event is triggered by the
         * mobile app when the back button of the device is pressed.
         *
         * @param {CustomEvent} ev
         */
        onBackButtonGlobal(ev) {
            if (!this.exists()) {
                return;
            }
            this.delete();
        },
    }
});
