odoo.define('voip.callCenterWidget', function (require) {
"use strict";

var AbstractField = require('web.AbstractField');
var core = require('web.core');
var field_registry = require('web.field_registry');
var _t = core._t;

var CallCenterWidget = AbstractField.extend({
    template: 'CallCenterWidget',
    events:_.extend({}, AbstractField.prototype.events, {
        'click': '_onClick',
    }),
    /**
     * @override
     */
    init: function () {
        this._super.apply(this, arguments);
        core.bus.on('voip_widget_refresh', this, this._onVoipRefresh);
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Returns the helper
     *
     * @returns {string}
     */
    getHelper: function () {
        return this.isInCallQueue() ? _t('Remove from Call Queue') : _t('Add to Call Queue');
    },
    /**
     * Returns if record has call in queue
     *
     * @returns {boolean}
     */
    isInCallQueue: function () {
        return this.value;
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _onClick: function () {
        var self = this;
        this._rpc({
            model: this.model,
            method: this.isInCallQueue() ? 'delete_call_in_queue' : 'create_call_in_queue',
            args: [this.res_id],
        }).then(function () {
            self.trigger_up('reload');
        });
    },
    /**
     * @private
     * @param {integer} resID
     */
    _onVoipRefresh: function (resID) {
        if (resID === this.res_id) {
            this.trigger_up('reload');
        }
    },
});

field_registry.add('call_center_widget', CallCenterWidget);
});
