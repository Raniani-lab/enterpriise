odoo.define('web_map.MapView', function (require) {
    "use strict";

    var MapModel = require('web_map.MapModel');
    var MapController = require('web_map.MapController');
    var MapRenderer = require('web_map.MapRenderer');
    var AbstractView = require('web.AbstractView');

    var viewRegistry = require('web.view_registry');
    var MapView = AbstractView.extend({
        jsLibs: [
            '/web_map/static/lib/leaflet/leaflet.js',
        ],
        config: _.extend({}, AbstractView.prototype.config, {
            Model: MapModel,
            Controller: MapController,
            Renderer: MapRenderer,
        }),
        icon: 'fa-map-marker',
        display_name: 'Map',
        viewType: 'map',
        searchMenuTypes: ['filter', 'favorite'],

        init: function (viewInfo, params) {
            this._super.apply(this, arguments);

            var fieldNames = [];
            var fieldNamesMarkerPopup = [];

            this.loadParams.resPartnerField = this.arch.attrs.res_partner;
            fieldNames.push(this.arch.attrs.res_partner);

            if (this.arch.attrs.default_order) {
                this.loadParams.orderBy = [{ name: this.arch.attrs.default_order, asc: true }];
            }

            this.loadParams.routing = this.arch.attrs.routing ? true : false;

            this.rendererParams.numbering = this.arch.attrs.routing || this.arch.attrs.default_order ? true : false;

            this.arch.children.forEach(function (node) {
                if (node.tag === 'marker-popup') {
                    node.children.forEach(function (child) {
                        if (child.tag === 'field') {
                            fieldNames.push(child.attrs.name);
                            fieldNamesMarkerPopup.push({ fieldName: child.attrs.name, string: child.attrs.string });
                        }
                    });
                }
            });
            this.loadParams.fieldNames = _.uniq(fieldNames);
            this.rendererParams.fieldNamesMarkerPopup = fieldNamesMarkerPopup;

            this.rendererParams.hasFormView = params.actionViews.find(function (view) {
                return view.type === "form";
            });
        },
    });
    viewRegistry.add('map', MapView);
    return MapView;
});
