odoo.define('web_studio.MockServer', function (require) {
'use strict';

var MockServer = require('web.MockServer');

MockServer.include({
    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @override
     * @private
     * @returns {Deferred}
     */
    _performRpc: function (route) {
        if (route === '/web_studio/get_default_value') {
            return $.when({});
        }
        if (route === '/web_studio/activity_allowed') {
            return $.when(false);
        }
        return this._super.apply(this, arguments);
    },
});

});
