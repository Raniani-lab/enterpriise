odoo.define('web_map.MapController', function (require) {
"use strict";

const AbstractController = require('web.AbstractController');
const core = require('web.core');
const qweb = core.qweb;
const Pager = require('web.Pager');

const MapController = AbstractController.extend({
    custom_events: _.extend({}, AbstractController.prototype.custom_events, {
        'pin_clicked': '_onPinClick',
        'get_itinerary_clicked': '_onGetItineraryClicked',
        'open_clicked': '_onOpenClicked',
    }),

    /**
     * @constructor
     */
    init: function (parent, model, renderer, params) {
        this._super.apply(this, arguments);
        this.actionName = params.actionName;
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @override
     * @param {JqueryElement} $node
     */

    renderButtons: function ($node) {
        let url = 'https://www.google.com/maps/dir/?api=1';
        if (this.model.data.records.length) {
            const coordinates = this.model.data.records
                .filter(record => record.partner && record.partner.partner_latitude && record.partner.partner_longitude)
                .map(record => record.partner.partner_latitude + ',' + record.partner.partner_longitude);
            url += `&waypoints=${_.uniq(coordinates).join('|')}`;
        }
        const $buttons = $(qweb.render("MapView.buttons"), { widget: this });
        $buttons.find('a').attr('href', url);
        $buttons.appendTo($node);
    },

    /**
     * @override
     * @param {JqueryElement} $node
     */
    renderPager: function ($node) {
        const params = this._getPagerParams();
        this.pager = new Pager(this, params.size, params.current_min, params.limit);
        this.pager.on('pager_changed', this, newState => {
            this.pager.disable();
            this.reload({ limit: newState.limit, offset: newState.current_min - 1 })
                .then(this.pager.enable.bind(this.pager));
        });
        return this.pager.appendTo($node);
    },
    /**
     * @override
     */
    update: function () {
        return this._super.apply(this, arguments).then(() => {
            this._updatePager();
        });
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Return the params (current_min, limit and size) to pass to the pager,
     * according to the current state.
     *
     * @private
     * @returns {Object}
     */
    _getPagerParams: function () {
        const state = this.model.get();
        return {
            current_min: state.offset + 1,
            limit: state.limit,
            size: state.count,
        };
    },
    /**
     * Update the pager with the current state.
     *
     * @private
     */
    _updatePager: function () {
        if (this.pager) {
            this.pager.updateState(this._getPagerParams());
        }
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * Redirects to google maps with all the records' coordinates.
     *
     * @private
     * @param {MouseEvent} ev
     */
    _onGetItineraryClicked: function (ev) {
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${ev.data.lat},${ev.data.lon}`);
    },
    /**
     * Redirects to views when clicked on open button in marker popup.
     *
     * @private
     * @param {MouseEvent} ev
     */
    _onOpenClicked: function (ev) {
        if (ev.data.ids.length > 1) {
            this.do_action({
                type: 'ir.actions.act_window',
                name: this.actionName,
                views: [[false, 'list'], [false, 'form']],
                res_model: this.modelName,
                domain: [['id', 'in', ev.data.ids]],
            });
        } else {
            this.trigger_up('switch_view', {
                view_type: 'form',
                res_id: ev.data.ids[0],
                mode: 'readonly',
                model: this.modelName
            });
        }
    }
});

return MapController;
});
