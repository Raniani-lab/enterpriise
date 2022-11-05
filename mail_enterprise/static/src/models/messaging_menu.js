/** @odoo-module **/

import { Patch } from '@mail/model';

import { useBackButton } from 'web_mobile.hooks';

Patch({
    name: 'MessagingMenu',
    componentSetup() {
        this._super();
        useBackButton(this.onBackButtonGlobal, () => this.isOpen);
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
            this.close();
        },
    }
});
