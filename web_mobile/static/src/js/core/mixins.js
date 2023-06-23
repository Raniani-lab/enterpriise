/** @odoo-module **/

import session from "web.session";
import mobile from "@web_mobile/js/services/core";
import { isIosApp } from "@web/core/browser/feature_detection";

/**
 * Mixin to setup lifecycle methods and allow to use 'backbutton' events sent
 * from the native application.
 *
 * @mixin
 * @name BackButtonEventMixin
 *
 */
export var BackButtonEventMixin = {
    /**
     * Register event listener for 'backbutton' event when attached to the DOM
     */
    on_attach_callback: function () {
        mobile.backButtonManager.addListener(this, this._onBackButton);
    },
    /**
     * Unregister event listener for 'backbutton' event when detached from the DOM
     */
    on_detach_callback: function () {
        mobile.backButtonManager.removeListener(this, this._onBackButton);
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {Event} ev 'backbutton' type event
     */
    _onBackButton: function () {},
};

/**
 * Mixin to hook into the controller record's saving method and
 * trigger the update of the user's account details on the mobile app.
 *
 * @mixin
 * @name UpdateDeviceAccountControllerMixin
 *
 */
const UpdateDeviceAccountControllerMixin = {
    /**
     * @override
     */
    async save() {
        const isSaved = await this._super(...arguments);
        if (!isSaved) {
            return false;
        }
        const updated = session.updateAccountOnMobileDevice();
        // Crapy workaround for unupdatable Odoo Mobile App iOS (Thanks Apple :@)
        if (!isIosApp()){
            await updated;
        }
        return true;
    },
};

export async function updateAccountOnMobileDevice() {
    const updated = session.updateAccountOnMobileDevice();
    // Crapy workaround for unupdatable Odoo Mobile App iOS (Thanks Apple :@)
    if (!isIosApp()){
        await updated;
    }
}

/**
 * Trigger the update of the user's account details on the mobile app as soon as
 * the session is correctly initialized.
 */
session.is_bound.then(() => session.updateAccountOnMobileDevice());

export default {
    BackButtonEventMixin: BackButtonEventMixin,
    UpdateDeviceAccountControllerMixin,
    updateAccountOnMobileDevice,
};
