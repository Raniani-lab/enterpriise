odoo.define('web_map.MapRenderer', function (require) {
"use strict";

const core = require('web.core');
const AbstractRenderer = require('web.AbstractRenderer');
const qweb = core.qweb;
const _t = core._t;

const MapRenderer = AbstractRenderer.extend({
    className: "o_map_view row no-gutters",

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @constructor
     */
    init: function (parent, state, params) {
        this._super.apply(this, arguments);
        this.fieldsMarkerPopup = params.fieldNamesMarkerPopup;
        this.routing = params.routing;
        this.numbering = params.numbering;
        this.hasFormView = params.hasFormView;
        this.defaultOrder = params.defaultOrder;
        this.hideName = params.hideName;
        this.hideAddress = params.hideAddress;

        this.isInDom = false;
        this.mapIsInit = false;
        this.markers = [];
        this.polylines = [];

        this.panelTitle = params.panelTitle;

        this.mapBoxToken = state.mapBoxToken;
        this.apiTilesRoute = 'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png';
        if (this.mapBoxToken) {
            this.apiTilesRoute = 'https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token={accessToken}';
        }
    },
    /*
     * Called each time the renderer is attached into the DOM.
     */
    on_attach_callback: function () {
        this.isInDom = true;
        this._initializeMap();
        const initialCoord = this._getLatLng();
        if (initialCoord) {
            this.leafletMap.fitBounds(initialCoord);
        } else {
            this.leafletMap.fitWorld();
        }
        this._addBanner();
        this._addMarkers(this.state.records);
        this._addRoutes(this.state.route);

        this._addPinList();
    },
    /*
     * Called each time the renderer is detached from the DOM.
     */
    on_detach_callback: function () {
        this.isInDom = false;
    },
    /**
     * Manually destroys the handlers to avoid memory leaks
     * destroys manually the map.
     *
     * @override
     */
    destroy: function () {
        this.markers.forEach(marker => marker.off('click'));
        this.polylines.forEach(polyline => polyline.off('click'));
        this.leafletMap.remove();
        return this._super.apply(this, arguments);
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Adds a warning banner when needed.
     *
     * @pivate
     */
    _addBanner: function () {
        let $banner;
        if (this.state.routingError) {
            $banner = $(qweb.render('MapView.routing_unavailable', {
                message: this.state.routingError,
            }));
        } else if (this.routing && !this.mapBoxToken) {
            $banner = $(qweb.render('MapView.no_map_token'));
        }
        if ($banner) {
            $banner.appendTo(this.$('.o_map_container'));
        }
    },
    /**
     * If there's located records, adds the corresponding marker on the map.
     * Binds events to the created markers.
     *
     * @private
     * @param {Array} records array that contains the records that needs to be displayed on the map
     * @param {Object} records.partner is the partner linked to the record
     * @param {float} records.partner.partner_latitude latitude of the partner and thus of the record
     * @param {float} records.partner.partner_longitude longitude of the partner and thus of the record
     */
    _addMarkers: function (records) {
        this._removeMarkers();

        const uniqueMarkerLocations = {};
        for (const record of records) {
            if (record.partner && record.partner.partner_latitude && record.partner.partner_longitude) {
                const key = _.str.sprintf('%s-%s', record.partner.partner_latitude, record.partner.partner_longitude);
                if (key in uniqueMarkerLocations) {
                    uniqueMarkerLocations[key].record = record;
                    uniqueMarkerLocations[key].ids.push(record.id);
                } else {
                    uniqueMarkerLocations[key] = { record: record, ids: [record.id] };
                }
            }
        }

        Object.values(uniqueMarkerLocations).forEach(markerLocation => {
            const record = markerLocation.record;
            const popup = { records: [] };
            // Only display address in multi co-ordinates marker popup
            if (markerLocation.ids.length > 1) {
                if (!this.hideAddress) {
                    popup.records = [{ field: record.partner.contact_address_complete, string: _t("Address") }];
                }
            } else {
                popup.records = this._getMarkerPopupFields(record, this.fieldsMarkerPopup);
            }
            popup.url = `https://www.google.com/maps/dir/?api=1&destination=${record.partner.partner_latitude},${record.partner.partner_longitude}`;
            const $popup = $(qweb.render('map-popup', { records: popup }));
            const openButton = $popup.find('button.btn.btn-primary.o_open')[0];
            if (this.hasFormView) {
                openButton.onclick = () => {
                    this.trigger_up('open_clicked', { ids: markerLocation.ids });
                };
            } else {
                openButton.remove();
            }

            let marker, offset;
            if (this.numbering) {
                let iconElement = `<p class ="o_number_icon">${this.state.records.indexOf(record) + 1}</p>`;
                if (markerLocation.ids.length > 1) {
                    iconElement =
                        `<p class ="o_number_icon">
                            ${this.state.records.indexOf(record) + 1}
                            <span class="badge badge-danger badge-pill border-0 o_map_marker_badge">${markerLocation.ids.length}</span>
                        </p>`;
                }

                const number = L.divIcon({
                    className: 'o_numbered_marker',
                    html: iconElement
                });
                marker = L.marker([record.partner.partner_latitude, record.partner.partner_longitude], { icon: number });
                offset = new L.Point(0, -38);

            } else {
                if (markerLocation.ids.length > 1) {
                    const number = L.divIcon({
                        className: 'o_custom_marker',
                        html: `<span class="badge badge-danger badge-pill border-0 o_map_marker_badge">${markerLocation.ids.length}</span>`,
                    });
                    marker = L.marker([record.partner.partner_latitude, record.partner.partner_longitude], { icon: number });
                    offset = new L.Point(0, -38);
                } else {
                    marker = L.marker([record.partner.partner_latitude, record.partner.partner_longitude]);
                    offset = new L.Point(0, 0);
                }
            }
            marker
                .addTo(this.leafletMap)
                .bindPopup(() => {
                    const divPopup = document.createElement('div');
                    $popup.each((i, element) => {
                        divPopup.appendChild(element);
                    });
                    return divPopup;
                }, { offset: offset });
            this.markers.push(marker);
        });
    },
    /**
     * Adds the list of records to the dom.
     *
     * @private
     */
    _addPinList: function () {
        this.$pinList = $(qweb.render('MapView.pinlist', { widget: this }));
        const $container = this.$el.find('.o_pin_list_container');
        if ($container.length) {
            $container.replaceWith(this.$pinList);
        } else {
            this.$el.append(this.$pinList);
        }

        this.$('.o_pin_list_container li a').on('click', this._centerAndOpenPin.bind(this));
    },
    /**
     * If there is computed routes, create polylines and add them to the map.
     * each element of this.state.route[0].legs array represent the route between two waypoints thus each of these must be a polyline.
     *
     * @private
     * @param {Object} route contains the data that allows to draw the rout between the records.
     */
    _addRoutes: function (route) {
        const self = this;
        this._removeRoutes();
        if (!this.mapBoxToken || !route.routes.length) {
            return;
        }

        route.routes[0].legs.forEach(leg => {
            const latLngs = [];
            leg.steps.forEach(step => {
                step.geometry.coordinates.forEach(coordinate => {
                    latLngs.push(L.latLng(coordinate[1], coordinate[0]));
                });
            });

            const polyline = L.polyline(latLngs, {
                color: 'blue',
                weight: 5,
                opacity: 0.3,
            }).addTo(this.leafletMap);

            polyline.on('click', function () {
                self.polylines.forEach(poly => {
                    poly.setStyle({ color: 'blue', opacity: 0.3 });
                });
                this.setStyle({ color: 'darkblue', opacity: 1.0 });
                this.bringToFront();
            });
            this.polylines.push(polyline);
        });
    },
    /**
     * Center the map on a certain pin and open the popup linked to it.
     *
     * @private
     * @param {MouseEvent} ev
     * @param {Number} ev.target.dataset.lat the latitude to pass leaflet
     * @param {Number} ev.target.dataset.lng the longitude to pass leaflet
     */
    _centerAndOpenPin: function (ev) {
        ev.preventDefault();
        this.leafletMap.panTo(ev.target.dataset, { animate: true });
        const marker = this.markers.find(m =>
            m._latlng.lat == ev.target.dataset.lat &&
            m._latlng.lng == ev.target.dataset.lng);
        if (marker) {
            marker.openPopup();
        }
    },
    /**
     * Creates an array of latLng objects if there is located records.
     *
     * @private
     * @returns {latLngBounds|boolean} objects containing the coordinates that allows all the records to be shown on the map or returns false if the records does not contain any located record
     */
    _getLatLng: function () {
        const tabLatLng = [];
        this.state.records.forEach(record => {
            if (record.partner && record.partner.partner_latitude && record.partner.partner_longitude) {
                tabLatLng.push(L.latLng(record.partner.partner_latitude, record.partner.partner_longitude));
            }
        });
        if (!tabLatLng.length) {
            return false;
        }
        return L.latLngBounds(tabLatLng);
    },
    /**
     * @private
     * @param {Object} record is a record from the database
     * @param {Object} fields is an object that contain all the field that are going to be shown in the view
     * @returns {Object} field: contains the value of the field and string contains the value of the xml's string attribute
     */
    _getMarkerPopupFields: function (record, fields) {
        const fieldsView = [];
        // Add 'hide_name' and 'hide_address' options field
        if (!this.hideName) {
            fieldsView.push({
                field: record.display_name,
                string: _t("Name"),
            });
        }
        if (!this.hideAddress) {
            fieldsView.push({
                field: record.partner.contact_address_complete,
                string: _t("Address"),
            });
        }
        fields.forEach(field => {
            if (record[field.fieldName]) {
                const fieldName = record[field.fieldName] instanceof Array ?
                    record[field.fieldName][1] :
                    record[field.fieldName];
                fieldsView.push({
                    field: fieldName,
                    string: field.string,
                });
            }
        });
        return fieldsView;
    },
    /**
     * Initialize the map, if there is located records the map is set to fit them at the maximum zoom level possible.
     * If there is no located record the map will fit the world.
     * The function also fetches the tiles.
     * The maxZoom property correspond to the maximum zoom level of the map. The greater the number,
     * the greater the user will be able to zoom.
     *
     * @private
     */
    _initializeMap: function () {
        if (this.mapIsInit) {
            return;
        }
        this.mapIsInit = true;
        const mapContainer = document.createElement("div");
        mapContainer.classList.add('o_map_container', 'col-md-12', 'col-lg-10');
        this.el.appendChild(mapContainer);
        this.leafletMap = L.map(mapContainer, {
            maxBounds: [L.latLng(180, -180), L.latLng(-180, 180)]
        });
        L.tileLayer(this.apiTilesRoute, {
            attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
            minZoom: 2,
            maxZoom: 19,
            id: 'mapbox.streets',
            accessToken: this.mapBoxToken,
        }).addTo(this.leafletMap);
    },
    /**
     * Remove the markers from the map and empties the markers array.
     *
     * @private
     */
    _removeMarkers: function () {
        this.markers.forEach(marker => {
            this.leafletMap.removeLayer(marker);
        });
        this.markers = [];
    },
    /**
     * Remove the routes from the map and empties the the polyline array.
     *
     * @private
     */
    _removeRoutes: function () {
        this.polylines.forEach(polyline => {
            this.leafletMap.removeLayer(polyline);
        });
        this.polylines = [];
    },
    /**
     * Render the map view.
     *
     * @private
     * @returns {Promise}
     */
    _render: function () {
        if (this.isInDom) {
            const initialCoord = this._getLatLng();
            if (initialCoord) {
                this.leafletMap.flyToBounds(initialCoord, { animate: false });
            } else {
                this.leafletMap.fitWorld();
            }
            this._addBanner();
            this._addMarkers(this.state.records);
            this._addRoutes(this.state.route);
            this._addPinList();
        }
        return Promise.resolve();
    },
});

return MapRenderer;
});
