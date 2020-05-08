odoo.define('web_map.MapModel', function (require) {
"use strict";

const AbstractModel = require('web.AbstractModel');
const session = require('web.session');
const core = require('web.core');
const _t = core._t;

const MapModel = AbstractModel.extend({

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @constructor
     */
    init: function () {
        this._super.apply(this, arguments);
        this.data = {};
        this.data.mapBoxToken = session.map_box_token;
    },
    get: function () {
        return this.data;
    },
    load: function (params) {
        this.data.count = 0;
        this.data.offset = 0;
        this.data.limit = 80;
        this.partnerToCache = [];
        this.partnerIds = [];
        this.resPartnerField = params.resPartnerField;
        this.model = params.modelName;
        this.context = params.context;
        this.fields = params.fieldNames;
        this.domain = params.domain;
        this.params = params;
        this.orderBy = params.orderBy;
        this.routing = params.routing;
        this.numberOfLocatedRecords = 0;
        return this._fetchData();
    },
    reload: function (handle, params) {
        const options = params || {};
        this.partnerToCache = [];
        this.partnerIds = [];
        this.numberOfLocatedRecords = 0;
        if (options.domain !== undefined) {
            this.domain = options.domain;
        }
        if (options.limit !== undefined) {
            this.data.limit = options.limit;
        }
        if (options.offset !== undefined) {
            this.data.offset = options.offset;
        }
        return this._fetchData();
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Adds the corresponding partner to a record.
     *
     * @private
     */
    _addPartnerToRecord: function () {
        this.data.records.forEach((record) => {
            this.data.partners.forEach((partner) => {
                let recordPartnerId;
                if (this.model === "res.partner" && this.resPartnerField === "id") {
                    recordPartnerId = record.id;
                } else {
                    recordPartnerId = record[this.resPartnerField][0];
                }

                if (recordPartnerId == partner.id) {
                    record.partner = partner;
                    this.numberOfLocatedRecords++;
                }
            });
        });
    },
    /**
     * The partner's coordinates should be between -90 <= latitude <= 90 and -180 <= longitude <= 180.
     *
     * @private
     * @param {Object} partner
     * @param {float} partner.partner_latitude latitude of the partner
     * @param {float} partner.partner_longitude longitude of the partner
     * @returns {boolean}
     */
    _checkCoordinatesValidity: function (partner) {
        if (partner.partner_latitude && partner.partner_longitude &&
            partner.partner_latitude >= -90 && partner.partner_latitude <= 90 &&
            partner.partner_longitude >= -180 && partner.partner_longitude <= 180) {
            return true;
        }
        return false;
    },
    /**
     * This function convert the addresses to coordinates using the mapbox API.
     *
     * @private
     * @param {Object} record this object contains the record fetched from the database.
     * @returns {Promise<result>} result.query contains the query the the api received
     *      result.features contains results in descendant order of relevance
     */
    _fetchCoordinatesFromAddressMB: function (record) {
        const address = encodeURIComponent(record.contact_address_complete);
        const token = this.data.mapBoxToken;
        const encodedUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${address}.json?access_token=${token}&cachebuster=1552314159970&autocomplete=true`;
        return new Promise((resolve, reject) => {
            $.get(encodedUrl).then(resolve).catch(reject);
        });
    },
    /**
     * This function convert the addresses to coordinates using the openStreetMap api.
     *
     * @private
     * @param {Object} record this object contains the record fetched from the database.
     * @returns {Promise<result>} result is an array that contains the result in descendant order of relevance
     *      result[i].lat is the latitude of the converted address
     *      result[i].lon is the longitude of the converted address
     *      result[i].importance is a float that the relevance of the result the closer the float is to one the best it is.
     */
    _fetchCoordinatesFromAddressOSM: function (record) {
        const address = encodeURIComponent(record.contact_address_complete.replace('/', ' '));
        const encodedUrl = `https://nominatim.openstreetmap.org/search/${address}?format=jsonv2`;
        return new Promise(function (resolve, reject) {
            $.get(encodedUrl).then(resolve).catch(reject);
        });
    },
    /**
     * Handles the case of an empty map.
     * Handles the case where the model is res_partner.
     * Fetches the records according to the model given in the arch.
     * If the records has no partner_id field it is sliced from the array.
     *
     * @private
     * @return {Promise}
     */
    _fetchData: async function () {
        //case of empty map
        if (!this.resPartnerField) {
            this.data.records = [];
            this.data.route = { routes: [] };
            return;
        }
        const results = await this._fetchRecordData();
        this.data.records = results.records;
        this.data.count = results.length;
        this.partnerIds = [];
        if (this.model === "res.partner" && this.resPartnerField === "id") {
            this.data.records.forEach((record) => {
                this.partnerIds.push(record.id);
                record.partner_id = [record.id];
            });
        } else {
            this._fillPartnerIds(this.data.records);
        }

        this.partnerIds = _.uniq(this.partnerIds);
        return this._partnerFetching(this.partnerIds);
    },
    /**
     * Fetch the records for a given model.
     *
     * @private
     * @returns {Promise<results>}
     */
    _fetchRecordData: function () {
        return this._rpc({
            route: '/web/dataset/search_read',
            model: this.model,
            context: this.context,
            fields: this.fields,
            domain: this.domain,
            orderBy: this.orderBy,
            limit: this.data.limit,
            offset: this.data.offset
        });
    },
    /**
     * @private
     * @param {Number[]} ids contains the ids from the partners
     * @returns {Promise}
     */
    _fetchRecordsPartner: function (ids) {
        return this._rpc({
            model: 'res.partner',
            method: 'search_read',
            fields: ['contact_address_complete', 'partner_latitude', 'partner_longitude'],
            domain: [['contact_address_complete', '!=', 'False'], ['id', 'in', ids]],
        });
    },
    /**
     * Fetch the route from the mapbox api.
     *
     * @private
     * @returns {Promise<results>}
     *      results.geometry.legs[i] contains one leg (i.e: the trip between two markers).
     *      results.geometry.legs[i].steps contains the sets of coordinates to follow to reach a point from an other.
     *      results.geometry.legs[i].distance: the distance in meters to reach the destination
     *      results.geometry.legs[i].duration the duration of the leg
     *      results.geometry.coordinates contains the sets of coordinates to go from the first to the last marker without the notion of waypoint
     */
    _fetchRoute: function () {
        const coordinatesParam = this.data.records
            .filter(record => record.partner.partner_latitude && record.partner.partner_longitude)
            .map(record => record.partner.partner_longitude + ',' + record.partner.partner_latitude);
        const address = encodeURIComponent(coordinatesParam.join(';'));
        const token = this.data.mapBoxToken;
        const encodedUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${address}?access_token=${token}&steps=true&geometries=geojson`;
        return new Promise(function (resolve, reject) {
            $.get(encodedUrl).then(resolve).catch(reject);
        });
    },
    /**
     * @private
     * @param {Object[]} records the records that are going to be filtered
     * @returns {Object[]} Array of records that contains a partner_id
     */
    _fillPartnerIds: function (records) {
        return records.forEach(record => {
            if (record[this.resPartnerField]) {
                this.partnerIds.push(record[this.resPartnerField][0]);
            }
        });
    },
    /**
     * Converts a MapBox error message into a custom translatable one.
     *
     * @private
     * @param {string} message
     */
    _getErrorMessage: function (message) {
        const ERROR_MESSAGES = {
            'Too many coordinates; maximum number of coordinates is 25': _t("Too many routing points (maximum 25)"),
            'Route exceeds maximum distance limitation': _t("Some routing points are too far apart"),
            'Too Many Requests': _t("Too many requests, try again in a few minutes"),
        };
        return ERROR_MESSAGES[message];
    },
    /**
     * Handles the case where the selected api is MapBox.
     * Iterates on all the partners and fetches their coordinates when they're not set.
     *
     * @private
     * @return {Promise<routeResult> | Promise<>} if there's more than 2 located records and the routing option is activated it returns a promise that fetches the route
     *      resultResult is an object that contains the computed route
     *      or if either of these conditions are not respected it returns an empty promise
     */
    _maxBoxAPI: function () {
        const promises = [];
        this.data.partners.forEach(partner => {
            if (partner.contact_address_complete && (!partner.partner_latitude || !partner.partner_longitude)) {
                promises.push(this._fetchCoordinatesFromAddressMB(partner).then(coordinates => {
                    if (coordinates.features.length) {
                        partner.partner_longitude = coordinates.features[0].geometry.coordinates[0];
                        partner.partner_latitude = coordinates.features[0].geometry.coordinates[1];
                        this.partnerToCache.push(partner);
                    }
                }));
            } else if (!this._checkCoordinatesValidity(partner)) {
                partner.partner_latitude = undefined;
                partner.partner_longitude = undefined;
            }
        });
        return Promise.all(promises).then(() => {
            this._addPartnerToRecord();
            this.data.route = { routes: [] };
            if (this.numberOfLocatedRecords > 1 && this.routing) {
                return this._fetchRoute().then(routeResult => {
                    if (routeResult.routes) {
                        this.data.route = routeResult;
                    } else {
                        this.data.routingError = this._getErrorMessage(routeResult.message);
                    }
                });
            } else {
                return Promise.resolve();
            }
        });
    },
    /**
     * Handles the displaying of error message according to the error.
     *
     * @private
     * @param {Object} err contains the error returned by the requests
     * @param {Number} err.status contains the status_code of the failed http request
     */
    _mapBoxErrorHandling: function (err) {
        switch (err.status) {
            case 401:
                this.do_warn(_t('Token invalid'), _t('The view has switched to another provider but functionalities will be limited'));
                break;
            case 403:
                this.do_warn(_t('Unauthorized connection'), _t('The view has switched to another provider but functionalities will be limited'));
                break;
            case 422:   // Max. addresses reached
            case 429:   // Max. requests reached
                this.data.routingError = this._getErrorMessage(err.responseJSON.message);
                break;
            case 500:
                this.do_warn(_t('MapBox servers unreachable'), _t('The view has switched to another provider but functionalities will be limited'));
        }
    },
    /**
     * Handles the case where the selected api is open street map.
     * Iterates on all the partners and fetches their coordinates when they're not set.
     *
     * @private
     * @return {Promise[]} returns an array of promise that fetches the coordinates from the address
     */
    _openStreetMapAPI: function () {
        const promises = [];
        this.data.partners.forEach(partner => {
            if (partner.contact_address_complete && (!partner.partner_latitude || !partner.partner_longitude)) {
                promises.push(this._fetchCoordinatesFromAddressOSM(partner).then(coordinates => {
                    if (coordinates.length) {
                        partner.partner_longitude = coordinates[0].lon;
                        partner.partner_latitude = coordinates[0].lat;
                        this.partnerToCache.push(partner);
                    }
                }));
            } else if (!this._checkCoordinatesValidity(partner)) {
                partner.partner_latitude = undefined;
                partner.partner_longitude = undefined;
            }
        });
        return Promise.all(promises.map(p => p.catch(error => null))).then(() => {
            this._addPartnerToRecord();
        });
    },
    /**
     * Fetches the partner which ids are contained in the the array partnerids
     * if the token is set it uses the mapBoxApi to fetch address and route
     * if not is uses the openstreetmap api to fetch the address.
     *
     * @private
     * @param {number[]} partnerIds this array contains the ids from the partner that are linked to records
     * @returns {Promise}
     */
    _partnerFetching: async function (partnerIds) {
        this.data.partners = partnerIds.length ? await this._fetchRecordsPartner(partnerIds) : [];
        if (this.data.mapBoxToken) {
            return this._maxBoxAPI()
                .then(() => {
                    this._writeCoordinatesUsers();
                }).catch((err) => {
                    this._mapBoxErrorHandling(err);
                    this.data.mapBoxToken = '';
                    return this._openStreetMapAPI();
                });
        } else {
            return this._openStreetMapAPI().then(() => {
                this._writeCoordinatesUsers();
            });
        }
    },
    /**
     * Writes partner_longitude and partner_latitude of the res.partner model.
     *
     * @private
     * @return {Promise}
     */
    _writeCoordinatesUsers: function () {
        if (this.partnerToCache.length) {
            this._rpc({
                model: 'res.partner',
                method: 'update_latitude_longitude',
                context: self.context,
                args: [this.partnerToCache]
            });
            this.partnerToCache = [];
        }
    },
});

return MapModel;
});
