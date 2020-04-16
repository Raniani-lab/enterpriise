odoo.define('web_mobile.notification_manager', function (require) {
"use strict";

var NotificationService = require('web.NotificationService');
const mobile = require('web_mobile.core');

NotificationService.include({

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    notify: function () {
        if (mobile.methods.vibrate) {
            mobile.methods.vibrate({'duration': 100});
        }
        return this._super.apply(this, arguments);
    },
});

});
