odoo.define('web_map.MapController', function (require) {
    'use strict';
    var AbstractController = require('web.AbstractController');
    var core = require('web.core');
    var qweb = core.qweb;
    var Pager = require('web.Pager');
    var MapController = AbstractController.extend({

        custom_events: _.extend({}, AbstractController.prototype.custom_events, {
            'pin_clicked': '_onPinClick',
            'get_itinerary_clicked': '_onGetItineraryClicked',
            'open_clicked': '_onOpenClicked',
        }),

        //---------------------------------------------------------------------------------
        //Public
        //-----------------------------------------------------------------------------

        init: function () {
            this._super.apply(this, arguments);
            this.pagers = [];
        },

        /**
         * @override
         * @param {JqueryElement} $node 
         */

        renderButtons: function ($node) {
            var url = 'https://www.google.com/maps/dir/?api=1';
            if (this.model.data.records.length) {
                url += '&waypoints=';
                this.model.data.records.forEach(function (record) {
                    url += record.partner.partner_latitude + ',' + record.partner.partner_longitude + '|';
                });
                url = url.slice(0, -1);
            }
            var $buttons = $(qweb.render("MapView.buttons"), { widget: this });
            $buttons.find('a').attr('href', url);
            $buttons.appendTo($node);
        },

        /**
         * @override
         * @param {JqueryElement} $node
         */
        renderPager: function ($node) {
            var self = this;
            var data = this.model.get();
            var options = {};
            options.single_page_hidden = true;
            this.pager = new Pager(this, data.count, data.offset + 1, data.limit, options);
            this.pager.on('pager_changed', this, function (newState) {
                this.pager.disable();
                data = this.model.get();
                this.reload({ limit: newState.limit, offset: newState.current_min - 1 })
                    .then(this.pager.enable.bind(this.pager));
            });
            return this.pager.appendTo($node).then(function () {
                self.pager.do_toggle(true);
            });
        },

        //-------------------------------------------------------------------------------------
        //Handler
        //------------------------------------------------------------------------------------

        /**
         * 
         * @param {MouseEvent} ev
         * @private
         * redirects to google maps with all the records' coordinates 
         */
        _onGetItineraryClicked: function (ev) {
            window.open('https://www.google.com/maps/dir/?api=1&destination=' + ev.data.lat + ',' + ev.data.lon);
        },

        /**
         * 
         * @param {MouseEvent} ev 
         * @private
         * Redirects to a form view in edit mode
         */
        _onOpenClicked: function (ev) {

            this.trigger_up('switch_view', {
                view_type: 'form',
                res_id: ev.data.id,
                mode: 'readonly',
                model: this.modelName
            });
        }
    });
    return MapController;
});
