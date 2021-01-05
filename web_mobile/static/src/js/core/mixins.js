odoo.define('web_mobile.mixins', function (require) {
"use strict";

const session = require('web.session');
const mobile = require('web_mobile.core');

/**
 * Mixin to setup lifecycle methods and allow to use 'backbutton' events sent
 * from the native application.
 *
 * @mixin
 * @name BackButtonEventMixin
 *
 */
var BackButtonEventMixin = {
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
    async saveRecord() {
        const changedFields = await this._super(...arguments);
        this.savingDef = this.savingDef.then(() => session.updateAccountOnMobileDevice());
        return changedFields;
    },
};

/**
 * Trigger the update of the user's account details on the mobile app as soon as
 * the session is correctly initialized.
 */
session.is_bound.then(() => session.updateAccountOnMobileDevice());

return {
    BackButtonEventMixin: BackButtonEventMixin,
    UpdateDeviceAccountControllerMixin,
};

});

odoo.define('web_mobile.hooks', function (require) {
"use strict";

const { backButtonManager } = require('web_mobile.core');

const { Component } = owl;
const { onWillUnmount } = owl.hooks;

/**
 * This hook provides support for executing code when the back button is pressed
 * on the mobile application of Odoo. This actually replaces the default back
 * button behavior so this feature should only be enabled when it is actually
 * useful.
 *
 * The feature must be enabled manually after every (re)mount (or whenever it is
 * appropriate), it can be disabled manually, and it is automatically disabled
 * on unmount and on destroy.
 *
 * @param {function} func the function to execute when the back button is
 *  pressed. The function is called with the custom event as param.
 * @returns {Object} exports the enable and disable functions to allow
 *  controlling the state of the listeners.
 */
function useBackButton(func) {
    const component = Component.current;

    /**
     * Enables the func listener, overriding default back button behavior.
     */
    function enable() {
        backButtonManager.addListener(component, func);
    }

    /**
     * Disables the func listener, restoring the default back button behavior if
     * no other listeners are present.
     */
    function disable() {
        backButtonManager.removeListener(component, func);
    }

    onWillUnmount(() => {
        disable();
    });

    const superDestroy = component.destroy.bind(component);
    component.destroy = function () {
        disable();
        superDestroy();
    };

    return {
        disable,
        enable,
    };
}

return {
    useBackButton,
};
});
