odoo.define('event_social_facebook.synchronize_facebook_events_widget', function (require) {
"use strict";


var widgetRegistry = require('web.widget_registry');
var Widget = require('web.Widget');

/*
 * Widget that fetch the Facebook events from the API
 */
var SynchronizeFacebookEvents = Widget.extend({
    tagName: 'i',
    className: 'o_synchronize_facebook_events_widget ml-2 fa fa-refresh border-0 bg-transparent p-1 oe_edit_only',
    events: {
        'click': '_onButtonClick',
    },

    _onButtonClick: function (event) {
        event.preventDefault();
        var self = this;
        this.$el.addClass('fa-spin');
        return this._rpc({
            model: 'social.facebook.event',
            method: 'fetch_facebook_events',
            args: [],
        }).then(function () {
            self.$el.removeClass('fa-spin');
        });
    }
});

widgetRegistry.add('synchronize_facebook_events_widget', SynchronizeFacebookEvents);
});
