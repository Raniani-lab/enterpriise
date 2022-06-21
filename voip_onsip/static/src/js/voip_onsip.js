odoo.define('voip.onsip', function (require) {
"use strict";

const UserAgent = require('voip.UserAgent');

UserAgent.include({

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    _getUaConfig(result) {
        let config = this._super(...arguments);
        config.authorizationUsername = result.onsip_auth_user;
        return config;
    },
});

});
