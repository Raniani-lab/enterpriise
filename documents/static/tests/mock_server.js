odoo.define('documents.MockServer', function (require) {
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
    _performRpc: function (route, args) {
        if (args.method === 'get_model_names') {
            return $.when([{
                res_model_count: 0,
                res_model: null,
                res_model_name: null
            }]);
        }
        if (route.indexOf('/documents/image') >= 0 || _.contains(['.png', '.jpg'], route.substr(route.length - 4))) {
            return $.when();
        }
        return this._super.apply(this, arguments);
    },
});

});
