/** @odoo-module **/

import { MapModel } from "@web_map/map_view/map_model";
import { makeView } from "@web/../tests/views/helpers";
import {
    setupControlPanelServiceRegistry,
    toggleFilterMenu,
    toggleMenuItem,
    toggleGroupByMenu,
} from "@web/../tests/search/helpers";
import { registry } from "@web/core/registry";
import { dialogService } from "@web/core/dialog/dialog_service";
import { click, nextTick, patchWithCleanup } from "@web/../tests/helpers/utils";
import { session } from "@web/session";
import { browser } from "@web/core/browser/browser";
import {
    makeFakeHTTPService,
    makeFakeLocalizationService,
} from "@web/../tests/helpers/mock_services";
import { Layout } from "@web/views/layout";
import { MapRenderer } from "@web_map/map_view/map_renderer";

const serviceRegistry = registry.category("services");

let serverData;
const MAP_BOX_TOKEN = "token";

function findMapRenderer(map) {
    const layout = Object.values(map.__owl__.children).find((c) => c instanceof Layout);
    return Object.values(layout.__owl__.children).find((c) => c instanceof MapRenderer);
}

QUnit.module("Views", (hooks) => {
    hooks.beforeEach(() => {
        const models = {
            "project.task": {
                fields: {
                    display_name: { string: "name", type: "char" },
                    sequence: { string: "sequence", type: "integer" },
                    partner_id: {
                        string: "partner",
                        type: "many2one",
                        relation: "res.partner",
                    },
                    another_partner_id: {
                        string: "another relation",
                        type: "many2one",
                        relation: "res.partner}",
                    },
                },
                records: [{ id: 1, display_name: "project", partner_id: 1 }],
                oneRecord: {
                    records: [{ id: 1, display_name: "Foo", partner_id: [1] }],
                    length: 1,
                },

                twoRecords: {
                    records: [
                        { id: 1, display_name: "FooProject", sequence: 1, partner_id: [1] },
                        { id: 2, display_name: "BarProject", sequence: 2, partner_id: [2] },
                    ],
                    length: 2,
                },

                threeRecords: {
                    records: [
                        { id: 1, display_name: "FooProject", sequence: 1, partner_id: [1] },
                        { id: 2, display_name: "BarProject", sequence: 2, partner_id: [2] },
                        {
                            id: 1,
                            display_name: "FooBarProject",
                            sequence: 3,
                            partner_id: [1],
                        },
                    ],
                    length: 3,
                },

                twoRecordOnePartner: {
                    records: [
                        { id: 1, display_name: "FooProject", partner_id: [1] },
                        { id: 2, display_name: "BarProject", partner_id: [1] },
                    ],
                    length: 2,
                },
                noRecord: {
                    records: [],
                    length: 0,
                },
                recordWithouthPartner: {
                    records: [{ id: 1, display_name: "Foo", partner_id: [] }],
                    length: 1,
                },
                anotherPartnerId: {
                    records: [{ id: 1, display_name: "FooProject", another_partner_id: [1] }],
                    length: 1,
                },
            },
            "res.partner": {
                fields: {
                    name: { string: "Customer", type: "char" },
                    partner_latitude: { string: "Latitude", type: "float" },
                    partner_longitude: { string: "Longitude", type: "float" },
                    contact_address_complete: { string: "Address", type: "char" },
                    task_ids: {
                        string: "Task",
                        type: "one2many",
                        relation: "project.task",
                        relation_field: "partner_id",
                    },
                    sequence: { string: "sequence", type: "integer" },
                },
                records: [
                    {
                        id: 1,
                        name: "Foo",
                        partner_latitude: 10.0,
                        partner_longitude: 10.5,
                        contact_address_complete: "Chaussée de Namur 40, 1367, Ramillies",
                        sequence: 1,
                    },
                    {
                        id: 2,
                        name: "Foo",
                        partner_latitude: 10.0,
                        partner_longitude: 10.5,
                        contact_address_complete: "Chaussée de Namur 40, 1367, Ramillies",
                        sequence: 3,
                    },
                    {
                        id: 3,
                        name: "Bar",
                        partner_latitude: 11.0,
                        partner_longitude: 11.5,
                        contact_address_complete: "Chaussée de Wavre 50, 1367, Ramillies",
                        sequence: 4,
                    },
                ],
                methods: {
                    update_latitude_longitude() {
                        return Promise.resolve();
                    },
                },
                coordinatesNoAddress: [
                    {
                        id: 1,
                        name: "Foo",
                        partner_latitude: 10.0,
                        partner_longitude: 10.5,
                    },
                ],
                oneLocatedRecord: [
                    {
                        id: 1,
                        name: "Foo",
                        partner_latitude: 10.0,
                        partner_longitude: 10.5,
                        contact_address_complete: "Chaussée de Namur 40, 1367, Ramillies",
                        sequence: 1,
                    },
                ],
                wrongCoordinatesNoAddress: [
                    {
                        id: 1,
                        name: "Foo",
                        partner_latitude: 10000.0,
                        partner_longitude: 100000.5,
                    },
                ],
                noCoordinatesGoodAddress: [
                    {
                        id: 1,
                        name: "Foo",
                        partner_latitude: 0,
                        partner_longitude: 0,
                        contact_address_complete: "Chaussée de Namur 40, 1367, Ramillies",
                    },
                ],
                emptyRecords: [],
                twoRecordsAddressNoCoordinates: [
                    {
                        id: 2,
                        name: "Foo",
                        contact_address_complete: "Chaussée de Namur 40, 1367, Ramillies",
                        sequence: 3,
                    },
                    {
                        id: 1,
                        name: "Bar",
                        contact_address_complete: "Chaussée de Louvain 94, 5310 Éghezée",
                        sequence: 1,
                    },
                ],
                twoRecordsAddressCoordinates: [
                    {
                        id: 2,
                        name: "Foo",
                        partner_latitude: 10.0,
                        partner_longitude: 10.5,
                        contact_address_complete: "Chaussée de Namur 40, 1367, Ramillies",
                        sequence: 3,
                    },
                    {
                        id: 1,
                        name: "Bar",
                        partner_latitude: 10.0,
                        partner_longitude: 10.5,
                        contact_address_complete: "Chaussée de Louvain 94, 5310 Éghezée",
                        sequence: 1,
                    },
                ],
                twoRecordsOneUnlocated: [
                    {
                        id: 1,
                        name: "Foo",
                        contact_address_complete: "Chaussée de Namur 40, 1367, Ramillies",
                        sequence: 3,
                    },
                    {
                        id: 2,
                        name: "Bar",
                    },
                ],
                unlocatedRecords: [{ id: 1, name: "Foo" }],
                noCoordinatesWrongAddress: [
                    {
                        id: 1,
                        name: "Foo",
                        contact_address_complete: "Cfezfezfefes",
                    },
                ],
            },
        };
        serverData = { models };
        setupControlPanelServiceRegistry();
        serviceRegistry.add("dialog", dialogService);
        serviceRegistry.add("localization", makeFakeLocalizationService());
        serviceRegistry.add("http", makeFakeHTTPService());

        patchWithCleanup(browser, {
            setTimeout: (fn) => fn(),
            clearTimeout: () => {},
        });

        patchWithCleanup(MapModel, {
            // set delay to 0 as _fetchCoordinatesFromAddressOSM is mocked
            COORDINATE_FETCH_DELAY: 0,
        });
        patchWithCleanup(MapModel.prototype, {
            _fetchCoordinatesFromAddressMB(metaData, data, record) {
                if (metaData.mapBoxToken !== MAP_BOX_TOKEN) {
                    return Promise.reject({ status: 401 });
                }
                const coordinates = [];
                coordinates[0] = 10.0;
                coordinates[1] = 10.5;
                const geometry = { coordinates };
                const features = [];
                features[0] = { geometry };
                const successResponse = { features };
                const failResponse = { features: [] };
                switch (record.contact_address_complete) {
                    case "Cfezfezfefes":
                        return Promise.resolve(failResponse);
                    case "":
                        return Promise.resolve(failResponse);
                }
                return Promise.resolve(successResponse);
            },
            _fetchCoordinatesFromAddressOSM(metaData, data, record) {
                const coordinates = [];
                coordinates[0] = { lat: 10.0, lon: 10.5 };
                switch (record.contact_address_complete) {
                    case "Cfezfezfefes":
                        return Promise.resolve([]);
                    case "":
                        return Promise.resolve([]);
                }
                return Promise.resolve(coordinates);
            },
            _fetchRoute(metaData, data) {
                if (metaData.mapBoxToken !== MAP_BOX_TOKEN) {
                    return Promise.reject({ status: 401 });
                }
                const legs = [];
                for (let i = 1; i < data.records.length; i++) {
                    const coordinates = [];
                    coordinates[0] = [10, 10.5];
                    coordinates[1] = [10, 10.6];
                    const geometry = { coordinates };
                    const steps = [];
                    steps[0] = { geometry };
                    legs.push({ steps: steps });
                }
                const routes = [];
                routes[0] = { legs };
                return Promise.resolve({ routes });
            },
            _notifyFetchedCoordinate(metaData, data) {
                // do not notify in tests as coords fetching is " synchronous "
            },
            _openStreetMapAPI(metaData, data) {
                // return promise to wait for it
                return this._openStreetMapAPIAsync(metaData, data);
            },
        });
    });

    QUnit.module("MapView");

    //--------------------------------------------------------------------------
    // Testing data fetching
    //--------------------------------------------------------------------------

    /**
     * data: no record
     * Should have no record
     * Should have no marker
     * Should have no route
     */
    QUnit.test("Create a view with no record", async function (assert) {
        assert.expect(8);
        patchWithCleanup(session, { map_box_token: MAP_BOX_TOKEN });
        const map = await makeView({
            config: { views: [] },
            serverData,
            type: "map",
            resModel: "project.task",
            arch: `
                    <map res_partner="partner_id" routing="1">
                        <field name="name" string="Project"/>
                    </map>
                `,
            async mockRPC(route, { model, kwargs }) {
                switch (route) {
                    case "/web/dataset/call_kw/project.task/web_search_read":
                        assert.strictEqual(
                            model,
                            "project.task",
                            "The model should be project.task"
                        );
                        assert.strictEqual(kwargs.fields[0], "partner_id");
                        assert.strictEqual(kwargs.fields[1], "display_name");
                        return serverData.models["project.task"].noRecord;
                    case "/web/dataset/call_kw/res.partner/search_read":
                        assert.ok(
                            false,
                            "Should not search_read the partners if there are no partner"
                        );
                }
            },
        });
        assert.strictEqual(
            map.el.querySelector("a.btn.btn-primary").href,
            "https://www.google.com/maps/dir/?api=1",
            "The link's URL should not contain any coordinates"
        );
        assert.strictEqual(
            map.model.metaData.resPartnerField,
            "partner_id",
            "the resPartnerField should be set"
        );
        assert.strictEqual(map.model.data.records.length, 0, "There should be no records");
        assert.containsNone(map.el, "div.leaflet-marker-icon", "No marker should be on a the map.");
        assert.containsNone(
            map.el.querySelector(".leaflet-overlay-pane"),
            "path",
            "No route should be shown"
        );
    });

    /**
     * data: one record that has no partner linked to it
     * The record should be kept and displayed in the list of records in gray (no clickable)
     * should have no marker
     * Should have no route
     */
    QUnit.test("Create a view with one record that has no partner", async function (assert) {
        assert.expect(5);
        patchWithCleanup(session, { map_box_token: MAP_BOX_TOKEN });
        const map = await makeView({
            config: { views: [] },
            serverData,
            type: "map",
            resModel: "project.task",
            arch: `<map res_partner="partner_id" routing="1" />`,
            async mockRPC(route) {
                switch (route) {
                    case "/web/dataset/call_kw/project.task/web_search_read":
                        return serverData.models["project.task"].recordWithouthPartner;
                    case "/web/dataset/call_kw/res.partner/search_read":
                        return serverData.models["res.partner"].emptyRecords;
                }
            },
        });
        assert.strictEqual(map.model.data.records.length, 1, "There should be 1 records");
        assert.containsNone(map.el, "div.leaflet-marker-icon", "No marker should be on a the map.");
        assert.containsNone(
            map.el.querySelector(".leaflet-overlay-pane"),
            "path",
            "No route should be shown"
        );
        assert.containsOnce(
            map.el,
            ".o-map-renderer--pin-list-container .o-map-renderer--pin-list-details li"
        );
        assert.containsOnce(
            map.el,
            ".o-map-renderer--pin-list-container .o-map-renderer--pin-list-details li span"
        );
    });

    /**
     * data: one record that has a partner which has coordinates but no address
     * One record
     * One marker
     * no route
     */
    QUnit.test(
        "Create a view with one record and a partner located by coordinates",
        async function (assert) {
            assert.expect(3);
            patchWithCleanup(session, { map_box_token: MAP_BOX_TOKEN });
            const map = await makeView({
                config: { views: [] },
                serverData,
                type: "map",
                resModel: "project.task",
                arch: `<map res_partner="partner_id" routing="1" />`,
                async mockRPC(route) {
                    switch (route) {
                        case "/web/dataset/call_kw/project.task/web_search_read":
                            return serverData.models["project.task"].oneRecord;
                        case "/web/dataset/call_kw/res.partner/search_read":
                            return serverData.models["res.partner"].coordinatesNoAddress;
                    }
                },
            });
            assert.strictEqual(map.model.data.records.length, 1, "There should be one records");
            assert.containsOnce(
                map.el,
                "div.leaflet-marker-icon",
                "There should be one marker on the map"
            );
            assert.containsNone(
                map.el.querySelector(".leaflet-overlay-pane"),
                "path",
                "There should be no route on the map"
            );
        }
    );

    /**
     * data: one record linked to one partner with no address and wrong coordinates
     * api: MapBox
     * record should be kept and displayed in the list
     * no route
     * no marker
     */
    QUnit.test(
        "Create view with one record linked to a partner with wrong coordinates with MB",
        async function (assert) {
            assert.expect(5);
            patchWithCleanup(session, { map_box_token: MAP_BOX_TOKEN });
            const map = await makeView({
                config: { views: [] },
                serverData,
                type: "map",
                resModel: "project.task",
                arch: `<map res_partner="partner_id" routing="1" />`,
                async mockRPC(route) {
                    switch (route) {
                        case "/web/dataset/call_kw/project.task/web_search_read":
                            return serverData.models["project.task"].oneRecord;
                        case "/web/dataset/call_kw/res.partner/search_read":
                            return serverData.models["res.partner"].wrongCoordinatesNoAddress;
                    }
                },
            });
            assert.strictEqual(map.model.data.records.length, 1, "There should be one records");
            assert.containsNone(
                map.el,
                "div.leaflet-marker-icon",
                "There should be np marker on the map"
            );
            assert.containsNone(
                map.el.querySelector(".leaflet-overlay-pane"),
                "path",
                "There should be no route on the map"
            );
            assert.containsOnce(
                map,
                ".o-map-renderer--pin-list-container .o-map-renderer--pin-list-details li"
            );
            assert.containsOnce(
                map,
                ".o-map-renderer--pin-list-container .o-map-renderer--pin-list-details li span"
            );
        }
    );

    /**
     * data: one record linked to one partner with no address and wrong coordinates
     * api: OpenStreet Map
     * record should be kept
     * no route
     * no marker
     */
    QUnit.test(
        "Create view with one record linked to a partner with wrong coordinates with OSM",
        async function (assert) {
            assert.expect(3);
            const map = await makeView({
                config: { views: [] },
                serverData,
                type: "map",
                resModel: "project.task",
                arch: `<map res_partner="partner_id" routing="1" />`,
                async mockRPC(route) {
                    switch (route) {
                        case "/web/dataset/call_kw/project.task/web_search_read":
                            return serverData.models["project.task"].oneRecord;
                        case "/web/dataset/call_kw/res.partner/search_read":
                            return serverData.models["res.partner"].wrongCoordinatesNoAddress;
                    }
                },
            });
            assert.strictEqual(map.model.data.records.length, 1, "There should be one records");
            assert.containsNone(
                map.el,
                "div.leaflet-marker-icon",
                "There should be no marker on the map"
            );
            assert.containsNone(
                map.el.querySelector(".leaflet-overlay-pane"),
                "path",
                "There should be no route on the map"
            );
        }
    );
    /**
     * data: one record linked to one partner with no coordinates and good address
     * api: OpenStreet Map
     * caching RPC called, assert good args
     * one record
     * no route
     */
    QUnit.test(
        "Create View with one record linked to a partner with no coordinates and right address OSM",
        async function (assert) {
            assert.expect(7);
            const map = await makeView({
                config: { views: [] },
                serverData,
                type: "map",
                resModel: "project.task",
                arch: `<map res_partner="partner_id" routing="1" />`,
                async mockRPC(route, { args, method, model }) {
                    switch (route) {
                        case "/web/dataset/call_kw/project.task/web_search_read":
                            return serverData.models["project.task"].oneRecord;
                        case "/web/dataset/call_kw/res.partner/search_read":
                            return serverData.models["res.partner"].noCoordinatesGoodAddress;
                        case "/web/dataset/call_kw/res.partner/update_latitude_longitude":
                            assert.strictEqual(
                                model,
                                "res.partner",
                                'The model should be "res.partner"'
                            );
                            assert.strictEqual(method, "update_latitude_longitude");
                            assert.strictEqual(
                                args[0].length,
                                1,
                                "There should be one record needing caching"
                            );
                            assert.strictEqual(args[0][0].id, 1, "The records's id should be 1");
                    }
                },
            });
            assert.strictEqual(map.model.data.records.length, 1, "There should be one records");
            assert.containsOnce(
                map.el,
                "div.leaflet-marker-icon",
                "There should be one marker on the map"
            );
            assert.containsNone(
                map.el.querySelector(".leaflet-overlay-pane"),
                "path",
                "There should be no route on the map"
            );
        }
    );

    /**
     * data: one record linked to one partner with no coordinates and good address
     * api: MapBox
     * caching RPC called, assert good args
     * one record
     * no route
     */
    QUnit.test(
        "Create View with one record linked to a partner with no coordinates and right address MB",
        async function (assert) {
            assert.expect(7);
            patchWithCleanup(session, { map_box_token: MAP_BOX_TOKEN });
            const map = await makeView({
                config: { views: [] },
                serverData,
                type: "map",
                resModel: "project.task",
                arch: `<map res_partner="partner_id" routing="1" />`,
                async mockRPC(route, { args, method, model }) {
                    switch (route) {
                        case "/web/dataset/call_kw/project.task/web_search_read":
                            return serverData.models["project.task"].oneRecord;
                        case "/web/dataset/call_kw/res.partner/search_read":
                            return serverData.models["res.partner"].noCoordinatesGoodAddress;
                        case "/web/dataset/call_kw/res.partner/update_latitude_longitude":
                            assert.strictEqual(
                                model,
                                "res.partner",
                                'The model should be "res.partner"'
                            );
                            assert.strictEqual(method, "update_latitude_longitude");
                            assert.strictEqual(
                                args[0].length,
                                1,
                                "There should be one record needing caching"
                            );
                            assert.strictEqual(args[0][0].id, 1, "The records's id should be 1");
                    }
                },
            });
            assert.strictEqual(map.model.data.records.length, 1, "There should be one records");
            assert.containsOnce(
                map.el,
                "div.leaflet-marker-icon",
                "There should be one marker on the map"
            );
            assert.containsNone(
                map.el.querySelector(".leaflet-overlay-pane"),
                "path",
                "There should be no route on the map"
            );
        }
    );

    /**
     * data: one record linked to a partner with no coordinates and no address
     * api: MapBox
     * 1 record
     * no route
     * no marker
     */
    QUnit.test("Create view with no located record", async function (assert) {
        assert.expect(3);
        patchWithCleanup(session, { map_box_token: MAP_BOX_TOKEN });
        const map = await makeView({
            config: { views: [] },
            serverData,
            type: "map",
            resModel: "project.task",
            arch: `<map res_partner="partner_id" routing="1" />`,
            async mockRPC(route) {
                switch (route) {
                    case "/web/dataset/call_kw/project.task/web_search_read":
                        return serverData.models["project.task"].oneRecord;
                    case "/web/dataset/call_kw/res.partner/search_read":
                        return serverData.models["res.partner"].unlocatedRecords;
                }
            },
        });
        assert.strictEqual(map.model.data.records.length, 1, "There should be one records");
        assert.containsNone(map.el, "div.leaflet-marker-icon", "No marker should be on a the map.");
        assert.containsNone(
            map.el.querySelector(".leaflet-overlay-pane"),
            "path",
            "No route should be shown"
        );
    });

    /**
     * data: one record linked to a partner with no coordinates and no address
     * api: OSM
     * one record
     * no route
     * no marker
     */
    QUnit.test("Create view with no located record OSM", async function (assert) {
        assert.expect(3);
        const map = await makeView({
            config: { views: [] },
            serverData,
            type: "map",
            resModel: "project.task",
            arch: `<map res_partner="partner_id" routing="1" />`,
            async mockRPC(route) {
                switch (route) {
                    case "/web/dataset/call_kw/project.task/web_search_read":
                        return serverData.models["project.task"].oneRecord;
                    case "/web/dataset/call_kw/res.partner/search_read":
                        return serverData.models["res.partner"].unlocatedRecords;
                }
            },
        });
        assert.strictEqual(map.model.data.records.length, 1, "There should be one records");
        assert.containsNone(map.el, "div.leaflet-marker-icon", "No marker should be on a the map.");
        assert.containsNone(
            map.el.querySelector(".leaflet-overlay-pane"),
            "path",
            "No route should be shown"
        );
    });

    /**
     * data: one record linked to a partner with no coordinates and wrong address
     * api: OSM
     * one record
     * no route
     * no marker
     */
    QUnit.test("Create view with no badly located record OSM", async function (assert) {
        assert.expect(3);
        const map = await makeView({
            config: { views: [] },
            serverData,
            type: "map",
            resModel: "project.task",
            arch: `<map res_partner="partner_id" routing="1" />`,
            async mockRPC(route) {
                switch (route) {
                    case "/web/dataset/call_kw/project.task/web_search_read":
                        return serverData.models["project.task"].oneRecord;
                    case "/web/dataset/call_kw/res.partner/search_read":
                        return serverData.models["res.partner"].noCoordinatesWrongAddress;
                }
            },
        });
        assert.strictEqual(map.model.data.records.length, 1, "There should be one records");
        assert.containsNone(map.el, "div.leaflet-marker-icon", "No marker should be on a the map.");
        assert.containsNone(
            map.el.querySelector(".leaflet-overlay-pane"),
            "path",
            "No route should be shown"
        );
    });

    /**
     * data: one record linked to a partner with no coordinates and wrong address
     * api: mapbox
     * one record
     * no route
     * no marker
     */

    QUnit.test("Create view with no badly located record MB", async function (assert) {
        assert.expect(3);
        patchWithCleanup(session, { map_box_token: MAP_BOX_TOKEN });
        const map = await makeView({
            config: { views: [] },
            serverData,
            type: "map",
            resModel: "project.task",
            arch: `<map res_partner="partner_id" routing="1" />`,
            async mockRPC(route) {
                switch (route) {
                    case "/web/dataset/call_kw/project.task/web_search_read":
                        return serverData.models["project.task"].oneRecord;
                    case "/web/dataset/call_kw/res.partner/search_read":
                        return serverData.models["res.partner"].noCoordinatesWrongAddress;
                }
            },
        });
        assert.strictEqual(map.model.data.records.length, 1, "There should be one records");
        assert.containsNone(map.el, "div.leaflet-marker-icon", "No marker should be on a the map.");
        assert.containsNone(
            map.el.querySelector(".leaflet-overlay-pane"),
            "path",
            "No route should be shown"
        );
    });

    /**
     * data: 2 records linked to the same partner
     * 2 records
     * 2 markers
     * no route
     * same partner object
     * 1 caching request
     */
    QUnit.test("Create a view with two located records same partner", async function (assert) {
        assert.expect(4);
        patchWithCleanup(session, { map_box_token: MAP_BOX_TOKEN });
        const map = await makeView({
            config: { views: [] },
            serverData,
            type: "map",
            resModel: "project.task",
            arch: `<map res_partner="partner_id" routing="1" />`,
            async mockRPC(route) {
                switch (route) {
                    case "/web/dataset/call_kw/project.task/web_search_read":
                        return serverData.models["project.task"].twoRecordOnePartner;
                    case "/web/dataset/call_kw/res.partner/search_read":
                        return serverData.models["res.partner"].oneLocatedRecord;
                }
            },
        });
        assert.strictEqual(map.model.data.records.length, 2, "There should be 2 records");
        assert.strictEqual(
            map.el.querySelector("div.leaflet-marker-icon .o-map-renderer--marker-badge")
                .textContent,
            "2",
            "There should be a marker for two records"
        );
        assert.containsOnce(
            map.el.querySelector(".leaflet-overlay-pane"),
            "path",
            "There should be one route showing"
        );
        assert.equal(
            map.model.data.records[0].partner,
            map.model.data.records[1].partner,
            "The records should have the same partner object as a property"
        );
    });

    /**
     * data: 2 records linked to differnet partners
     * 2 records
     * 1 route
     * different partner object.
     * 2 caching
     */
    QUnit.test(
        "Create a a view with two located records different partner",
        async function (assert) {
            assert.expect(5);
            patchWithCleanup(session, { map_box_token: MAP_BOX_TOKEN });
            const map = await makeView({
                config: { views: [] },
                serverData,
                type: "map",
                resModel: "project.task",
                arch: `<map res_partner="partner_id" routing="1" />`,
                async mockRPC(route, { args }) {
                    switch (route) {
                        case "/web/dataset/call_kw/project.task/web_search_read":
                            return serverData.models["project.task"].twoRecords;
                        case "/web/dataset/call_kw/res.partner/search_read":
                            return serverData.models["res.partner"].twoRecordsAddressNoCoordinates;
                        case "/web/dataset/call_kw/res.partner/update_latitude_longitude":
                            assert.strictEqual(
                                args[0].length,
                                2,
                                "Should have 2 record needing caching"
                            );
                    }
                },
            });
            assert.strictEqual(map.model.data.records.length, 2, "There should be 2 records");
            assert.strictEqual(
                map.el.querySelector("div.leaflet-marker-icon .o-map-renderer--marker-badge")
                    .textContent,
                "2",
                "There should be a marker for two records"
            );
            assert.containsOnce(
                map.el.querySelector(".leaflet-overlay-pane"),
                "path",
                "There should be one route showing"
            );
            assert.notEqual(
                map.model.data.records[0].partner,
                map.model.data.records[1].partner,
                "The records should have the same partner object as a property"
            );
        }
    );

    /**
     * data: 2 valid res.partner records
     * test the case where the model is res.partner and the "res.partner" field is the id
     * should have 2 records,
     * 2 markers
     * no route
     */
    QUnit.test("Create a view with res.partner", async function (assert) {
        assert.expect(8);
        patchWithCleanup(session, { map_box_token: MAP_BOX_TOKEN });
        serverData.models["res.partner"].recordsPrimary = {
            records: [
                {
                    id: 2,
                    name: "Foo",
                    contact_address_complete: "Chaussée de Namur 40, 1367, Ramillies",
                    sequence: 3,
                },
                {
                    id: 1,
                    name: "FooBar",
                    contact_address_complete: "Chaussée de Louvain 94, 5310 Éghezée",
                    sequence: 1,
                },
            ],
            length: 2,
        };
        const map = await makeView({
            config: { views: [] },
            serverData,
            type: "map",
            resModel: "res.partner",
            arch: `<map res_partner="id" />`,
            async mockRPC(route, { kwargs, model }) {
                switch (route) {
                    case "/web/dataset/call_kw/res.partner/web_search_read":
                        assert.strictEqual(model, "res.partner", "The model should be res.partner");
                        assert.strictEqual(kwargs.fields[0], "id");
                        return serverData.models["res.partner"].recordsPrimary;
                    case "/web/dataset/call_kw/res.partner/search_read":
                        assert.strictEqual(
                            model,
                            "res.partner",
                            "The model should be res.partner as well"
                        );
                        assert.strictEqual(kwargs.domain[1][2][0], 2);
                        assert.strictEqual(kwargs.domain[1][2][1], 1);
                        return serverData.models["res.partner"].twoRecordsAddressNoCoordinates;
                }
            },
        });
        assert.strictEqual(map.model.data.records.length, 2, "There should be two records");
        assert.strictEqual(
            map.el.querySelector("div.leaflet-marker-icon .o-map-renderer--marker-badge")
                .textContent,
            "2",
            "There should be a marker for two records"
        );
        assert.containsNone(
            map.el.querySelector(".leaflet-overlay-pane"),
            "path",
            "There should be no route showing"
        );
    });

    /**
     * data: 3 records linked to one located partner and one unlocated
     * test if only the 2 located records are displayed
     */
    QUnit.test("Create a view with 2 located records and 1 unlocated", async function (assert) {
        assert.expect(4);
        patchWithCleanup(session, { map_box_token: MAP_BOX_TOKEN });
        const map = await makeView({
            config: { views: [] },
            serverData,
            type: "map",
            resModel: "project.task",
            arch: `<map res_partner="partner_id" routing="1" />`,
            async mockRPC(route) {
                switch (route) {
                    case "/web/dataset/call_kw/project.task/web_search_read":
                        return serverData.models["project.task"].threeRecords;
                    case "/web/dataset/call_kw/res.partner/search_read":
                        return serverData.models["res.partner"].twoRecordsOneUnlocated;
                }
            },
        });
        assert.strictEqual(map.model.data.records.length, 3);
        assert.strictEqual(map.model.data.records[0].partner.id, 1, "The partner's id should be 1");
        assert.strictEqual(map.model.data.records[1].partner.id, 2, "The partner's id should be 2");
        assert.strictEqual(map.model.data.records[2].partner.id, 1, "The partner's id should be 1");
    });

    QUnit.test("Change load limit", async function (assert) {
        assert.expect(2);
        patchWithCleanup(session, { map_box_token: MAP_BOX_TOKEN });
        serverData.models["project.task"].records =
            serverData.models["project.task"].threeRecords.records;
        serverData.models["res.partner"].records =
            serverData.models["res.partner"].twoRecordsAddressCoordinates;
        const map = await makeView({
            config: { views: [] },
            serverData,
            type: "map",
            resModel: "project.task",
            arch: `<map res_partner="partner_id" limit="2" />`,
        });
        assert.strictEqual(
            map.el.querySelector(`.o_pager_counter .o_pager_value`).textContent.trim(),
            "1-2"
        );
        assert.strictEqual(
            map.el.querySelector(`.o_pager_counter span.o_pager_limit`).innerText.trim(),
            "3"
        );
    });

    //--------------------------------------------------------------------------
    // Renderer testing
    //--------------------------------------------------------------------------

    QUnit.test("Google Maps redirection", async function (assert) {
        assert.expect(2);

        const map = await makeView({
            config: { views: [] },
            serverData,
            type: "map",
            resModel: "project.task",
            arch: `<map res_partner="partner_id"></map>`,
            async mockRPC(route) {
                switch (route) {
                    case "/web/dataset/call_kw/project.task/web_search_read":
                        return serverData.models["project.task"].twoRecords;
                    case "/web/dataset/call_kw/res.partner/search_read":
                        return serverData.models["res.partner"].twoRecordsAddressNoCoordinates;
                }
            },
        });

        assert.strictEqual(
            map.el.querySelector("a.btn.btn-primary").href,
            "https://www.google.com/maps/dir/?api=1&waypoints=10,10.5",
            "The link's URL should contain the right sets of coordinates"
        );

        await click(map.el, ".leaflet-marker-icon");
        assert.strictEqual(
            map.el.querySelector("div.leaflet-popup a.btn.btn-primary").href,
            "https://www.google.com/maps/dir/?api=1&destination=10,10.5",
            "The link's URL should the right set of coordinates"
        );
    });

    QUnit.test("Google Maps redirection (with routing = true)", async function (assert) {
        assert.expect(2);

        const map = await makeView({
            config: { views: [] },
            serverData,
            type: "map",
            resModel: "project.task",
            arch: `<map res_partner="partner_id" routing="1"></map>`,
            async mockRPC(route) {
                switch (route) {
                    case "/web/dataset/call_kw/project.task/web_search_read":
                        return serverData.models["project.task"].twoRecords;
                    case "/web/dataset/call_kw/res.partner/search_read":
                        return serverData.models["res.partner"].twoRecordsAddressNoCoordinates;
                }
            },
        });

        assert.strictEqual(
            map.el.querySelector("a.btn.btn-primary").href,
            "https://www.google.com/maps/dir/?api=1&destination=10,10.5",
            "The link's URL should contain the right sets of coordinates"
        );

        await click(map.el, ".leaflet-marker-icon");
        assert.strictEqual(
            map.el.querySelector("div.leaflet-popup a.btn.btn-primary").href,
            "https://www.google.com/maps/dir/?api=1&destination=10,10.5",
            "The link's URL should the right set of coordinates"
        );
    });

    QUnit.test("Unicity of coordinates in Google Maps url", async function (assert) {
        assert.expect(2);
        patchWithCleanup(session, { map_box_token: MAP_BOX_TOKEN });
        const map = await makeView({
            config: { views: [] },
            serverData,
            type: "map",
            resModel: "project.task",
            arch: `<map res_partner="partner_id" />`,
            async mockRPC(route) {
                switch (route) {
                    case "/web/dataset/call_kw/project.task/web_search_read":
                        return serverData.models["project.task"].twoRecordOnePartner;
                    case "/web/dataset/call_kw/res.partner/search_read":
                        return serverData.models["res.partner"].twoRecordsAddressNoCoordinates;
                }
            },
        });
        assert.strictEqual(
            map.el.querySelector("a.btn.btn-primary").href,
            "https://www.google.com/maps/dir/?api=1&waypoints=10.5,10",
            "The link's URL should contain unqiue sets of coordinates"
        );
        await click(map.el, ".leaflet-marker-icon");
        assert.strictEqual(
            map.el.querySelector("div.leaflet-popup a.btn.btn-primary").href,
            "https://www.google.com/maps/dir/?api=1&destination=10.5,10",
            "The link's URL should only contain unqiue sets of coordinates"
        );
    });

    QUnit.test("test the position of pin", async function (assert) {
        assert.expect(4);
        const map = await makeView({
            config: { views: [] },
            serverData,
            type: "map",
            resModel: "project.task",
            arch: `<map res_partner="partner_id" />`,
            async mockRPC(route) {
                switch (route) {
                    case "/web/dataset/call_kw/project.task/web_search_read":
                        return serverData.models["project.task"].twoRecords;
                    case "/web/dataset/call_kw/res.partner/search_read":
                        return serverData.models["res.partner"].twoRecordsAddressNoCoordinates;
                }
            },
        });

        assert.containsOnce(map.el, ".o-map-renderer--marker", "Should have one marker created");
        assert.strictEqual(
            map.el.querySelector("div.leaflet-marker-icon .o-map-renderer--marker-badge")
                .textContent,
            "2",
            "There should be a marker for two records"
        );
        const renderer = findMapRenderer(map);
        assert.strictEqual(
            renderer.markers[0].getLatLng().lat,
            10,
            "The latitude should be the same as the record"
        );
        assert.strictEqual(
            renderer.markers[0].getLatLng().lng,
            10.5,
            "The longitude should be the same as the record"
        );
    });

    /**
     * data: two located records
     * Create an empty map
     */
    QUnit.test("Create of a empty map", async function (assert) {
        assert.expect(6);

        const map = await makeView({
            config: { views: [] },
            serverData,
            type: "map",
            resModel: "res.partner",
            arch: `<map />`,
            async mockRPC(route) {
                switch (route) {
                    case "/web/dataset/call_kw/project.task/web_search_read":
                        return serverData.models["project.task"].twoRecords;
                    case "/web/dataset/call_kw/res.partner/search_read":
                        return serverData.models["res.partner"].twoRecordsAddressNoCoordinates;
                }
            },
        });
        assert.notOk(map.model.metaData.resPartnerField, "the resPartnerField should not be set");

        assert.hasClass(map.el, "o_map_view", 'should have the class "o_map_view"');
        assert.containsOnce(map.el, ".leaflet-map-pane", "If the map exists this div should exist");
        assert.ok(
            map.el.querySelector(".leaflet-pane .leaflet-tile-pane").children.length,
            "The map tiles should have been happened to the DOM"
        );
        // if element o-map-renderer--container has class leaflet-container then
        // the map is mounted
        assert.hasClass(
            map.el.querySelector(".o-map-renderer--container"),
            "leaflet-container",
            "the map should be in the DOM"
        );

        assert.strictEqual(
            map.el.querySelector(".leaflet-overlay-pane").children.length,
            0,
            "Should have no showing route"
        );
    });

    /**
     * two located records
     * without routing or default_order
     * normal marker icon
     * test the click on them
     */
    QUnit.test("Create view with normal marker icons", async function (assert) {
        assert.expect(6);
        patchWithCleanup(session, { map_box_token: MAP_BOX_TOKEN });
        const map = await makeView({
            config: { views: [] },
            serverData,
            type: "map",
            resModel: "project.task",
            arch: `<map res_partner="partner_id" />`,
            async mockRPC(route) {
                switch (route) {
                    case "/web/dataset/call_kw/project.task/web_search_read":
                        return serverData.models["project.task"].twoRecords;
                    case "/web/dataset/call_kw/res.partner/search_read":
                        return serverData.models["res.partner"].twoRecordsAddressNoCoordinates;
                }
            },
        });
        assert.notOk(map.model.metaData.numbering, "the numbering option should not be enabled");
        assert.notOk(map.model.metaData.routing, "The routing option should not be enabled");

        assert.containsOnce(map.el, ".leaflet-marker-icon", "There should be 1 marker");
        assert.containsNone(
            map.el.querySelector(".leaflet-overlay-pane"),
            "path",
            "There should be no route showing"
        );

        await click(map.el, ".leaflet-marker-icon");

        assert.strictEqual(
            map.el.querySelector(".leaflet-popup-pane").children.length,
            1,
            "Should have one showing popup"
        );

        await click(map.el, "div.leaflet-container");
        // wait for the popup's destruction which takes a certain time...
        for (let i = 0; i < 15; i++) {
            await nextTick();
        }

        assert.strictEqual(
            map.el.querySelector(".leaflet-popup-pane").children.length,
            0,
            "Should not have any showing popup"
        );
    });

    /**
     * two located records
     * with default_order
     * no numbered icon
     * test click on them
     * asserts that the rpc receive the right parameters
     */
    QUnit.test("Create a view with default_order", async function (assert) {
        assert.expect(7);
        const map = await makeView({
            config: { views: [] },
            serverData,
            type: "map",
            resModel: "project.task",
            arch: `<map res_partner="partner_id" default_order="name" />`,
            async mockRPC(route, { kwargs }) {
                switch (route) {
                    case "/web/dataset/call_kw/project.task/web_search_read":
                        assert.deepEqual(
                            kwargs.order,
                            "name ASC",
                            "The sorting order should be on the field name in a ascendant way"
                        );
                        return serverData.models["project.task"].twoRecords;
                    case "/web/dataset/call_kw/res.partner/search_read":
                        return serverData.models["res.partner"].twoRecordsAddressNoCoordinates;
                }
            },
        });
        assert.notOk(map.model.metaData.numbering, "the numbering option should not be enabled");
        assert.notOk(map.model.metaData.routing, "The routing option should not be enabled");
        assert.containsOnce(map.el, "div.leaflet-marker-icon", "There should be 1 marker");
        assert.strictEqual(
            map.el.querySelector("div.leaflet-marker-icon .o-map-renderer--marker-badge")
                .textContent,
            "2",
            "There should be a marker for two records"
        );
        assert.strictEqual(
            map.el.querySelector(".leaflet-popup-pane").children.length,
            0,
            "Should have no showing popup"
        );
        await click(map.el, "div.leaflet-marker-icon");
        assert.strictEqual(
            map.el.querySelector(".leaflet-popup-pane").children.length,
            1,
            "Should have one showing popup"
        );
    });

    /**
     * two locted records
     * with routing enabled
     * numbered icon
     * test click on route
     */
    QUnit.test("Create a view with routing", async function (assert) {
        assert.expect(9);
        patchWithCleanup(session, { map_box_token: MAP_BOX_TOKEN });

        const map = await makeView({
            config: { views: [] },
            serverData,
            type: "map",
            resModel: "project.task",
            arch: `<map res_partner="partner_id" routing="1" />`,
            async mockRPC(route) {
                switch (route) {
                    case "/web/dataset/call_kw/project.task/web_search_read":
                        return serverData.models["project.task"].twoRecords;
                    case "/web/dataset/call_kw/res.partner/search_read":
                        return serverData.models["res.partner"].twoRecordsAddressNoCoordinates;
                }
            },
        });
        assert.ok(map.model.metaData.numbering, "The numbering option should be enabled");
        assert.ok(map.model.metaData.routing, "The routing option should be enabled");

        assert.strictEqual(
            map.model.data.numberOfLocatedRecords,
            2,
            "Should have 2 located Records"
        );
        assert.strictEqual(map.model.data.routes.length, 1, "Should have 1 computed route");
        assert.strictEqual(
            map.el.querySelector("div.leaflet-marker-icon .o-map-renderer--marker-badge")
                .textContent,
            "2",
            "There should be a marker for two records"
        );
        assert.strictEqual(
            map.el.querySelector("path.leaflet-interactive").getAttribute("stroke"),
            "blue",
            "The route should be blue if it has not been clicked"
        );
        assert.strictEqual(
            map.el.querySelector("path.leaflet-interactive").getAttribute("stroke-opacity"),
            "0.3",
            "The opacity of the polyline should be 0.3"
        );
        await click(map.el, "path.leaflet-interactive");
        assert.strictEqual(
            map.el.querySelector("path.leaflet-interactive").getAttribute("stroke"),
            "darkblue",
            "The route should be darkblue after being clicked"
        );
        assert.strictEqual(
            map.el.querySelector("path.leaflet-interactive").getAttribute("stroke-opacity"),
            "1",
            "The opacity of the polyline should be 1"
        );
    });

    QUnit.test("Create a view with routingError", async function (assert) {
        assert.expect(1);
        patchWithCleanup(session, { map_box_token: MAP_BOX_TOKEN });
        patchWithCleanup(MapModel.prototype, {
            async _maxBoxAPI(metaData, data) {
                data.routingError = "this is test warning";
                data.routes = [];
            },
        });

        const map = await makeView({
            config: { views: [] },
            serverData,
            type: "map",
            resModel: "project.task",
            arch: `<map res_partner="partner_id" routing="1" />`,
            async mockRPC(route) {
                switch (route) {
                    case "/web/dataset/call_kw/project.task/web_search_read":
                        return serverData.models["project.task"].twoRecords;
                    case "/web/dataset/call_kw/res.partner/search_read":
                        return [];
                }
            },
        });

        assert.containsOnce(
            map.el,
            ".o-map-renderer > .o-map-renderer--alert",
            "should have alert"
        );
    });

    /**
     * routing with token and one located record
     * No route
     */
    QUnit.test("create a view with routing and one located record", async function (assert) {
        assert.expect(2);
        patchWithCleanup(session, { map_box_token: MAP_BOX_TOKEN });
        const map = await makeView({
            config: { views: [] },
            serverData,
            type: "map",
            resModel: "project.task",
            arch: `<map res_partner="partner_id" routing="1" />`,
            async mockRPC(route) {
                switch (route) {
                    case "/web/dataset/call_kw/project.task/web_search_read":
                        return serverData.models["project.task"].oneRecord;
                    case "/web/dataset/call_kw/res.partner/search_read":
                        return serverData.models["res.partner"].oneLocatedRecord;
                }
            },
        });
        assert.ok(map.model.metaData.routing, "The routing option should be enabled");
        assert.strictEqual(map.model.data.routes.length, 0, "Should have no computed route");
    });

    /**
     * no mapbox token
     * assert that the view uses the right api and routes
     */
    QUnit.test("CreateView with empty mapbox token setting", async function (assert) {
        assert.expect(2);

        const map = await makeView({
            config: { views: [] },
            serverData,
            type: "map",
            resModel: "project.task",
            arch: `<map res_partner="partner_id" />`,
            async mockRPC(route) {
                switch (route) {
                    case "/web/dataset/call_kw/project.task/web_search_read":
                        return serverData.models["project.task"].recordWithouthPartner;
                    case "/web/dataset/call_kw/res.partner/search_read":
                        return serverData.models["res.partner"].emptyRecords;
                }
            },
        });
        assert.strictEqual(
            map.model.metaData.mapBoxToken,
            "",
            "The token should be an empty string"
        );
        assert.notOk(map.model.data.useMapBoxAPI, "model should not use mapbox");
    });

    /**
     * wrong mapbox token
     * assert that the view uses the openstreetmap api
     */
    QUnit.test("Create a view with wrong map box setting", async function (assert) {
        assert.expect(2);
        patchWithCleanup(session, { map_box_token: "vrve" });
        const map = await makeView({
            config: { views: [] },
            serverData,
            type: "map",
            resModel: "project.task",
            arch: `<map res_partner="partner_id" routing="1" />`,
            async mockRPC(route) {
                switch (route) {
                    case "/web/dataset/call_kw/project.task/web_search_read":
                        return serverData.models["project.task"].twoRecords;
                    case "/web/dataset/call_kw/res.partner/search_read":
                        return serverData.models["res.partner"].twoRecordsAddressNoCoordinates;
                }
            },
        });
        assert.strictEqual(map.model.metaData.mapBoxToken, "vrve", "The token should be kept");
        assert.notOk(map.model.data.useMapBoxAPI, "model should not use mapbox");
    });

    /**
     * wrong mapbox token fails at catch at route computing
     */
    QUnit.test(
        "create a view with wrong map box setting and located records",
        async function (assert) {
            assert.expect(2);
            patchWithCleanup(session, { map_box_token: "frezfre" });
            const map = await makeView({
                config: { views: [] },
                serverData,
                type: "map",
                resModel: "project.task",
                arch: `<map res_partner="partner_id" routing="1" />`,
                async mockRPC(route) {
                    switch (route) {
                        case "/web/dataset/call_kw/project.task/web_search_read":
                            return serverData.models["project.task"].twoRecords;
                        case "/web/dataset/call_kw/res.partner/search_read":
                            return serverData.models["res.partner"].twoRecordsAddressCoordinates;
                    }
                },
            });
            assert.strictEqual(
                map.model.metaData.mapBoxToken,
                "frezfre",
                "The token should be kept"
            );
            assert.notOk(map.model.data.useMapBoxAPI, "model should not use mapbox");
        }
    );

    /**
     * create view with right map box token
     * assert that the view uses the map box api
     */
    QUnit.test("Create a view with the right map box token", async function (assert) {
        assert.expect(2);
        patchWithCleanup(session, { map_box_token: MAP_BOX_TOKEN });
        const map = await makeView({
            config: { views: [] },
            serverData,
            type: "map",
            resModel: "project.task",
            arch: `<map res_partner="partner_id" routing="1" />`,
            async mockRPC(route) {
                switch (route) {
                    case "/web/dataset/call_kw/project.task/web_search_read":
                        return serverData.models["project.task"].recordWithouthPartner;
                    case "/web/dataset/call_kw/res.partner/search_read":
                        return serverData.models["res.partner"].emptyRecords;
                }
            },
        });
        assert.strictEqual(
            map.model.metaData.mapBoxToken,
            "token",
            "The token should be the right token"
        );
        assert.ok(map.model.data.useMapBoxAPI, "model should use mapbox");
    });

    /**
     * data: two located records
     */
    QUnit.test(
        "Click on pin shows popup, click on another shuts the first and open the other",
        async function (assert) {
            assert.expect(3);
            patchWithCleanup(session, { map_box_token: MAP_BOX_TOKEN });
            const map = await makeView({
                config: { views: [] },
                serverData,
                type: "map",
                resModel: "project.task",
                arch: `<map res_partner="partner_id" routing="1" />`,
                async mockRPC(route) {
                    switch (route) {
                        case "/web/dataset/call_kw/project.task/web_search_read":
                            return serverData.models["project.task"].twoRecords;
                        case "/web/dataset/call_kw/res.partner/search_read":
                            return serverData.models["res.partner"].twoRecordsAddressNoCoordinates;
                    }
                },
            });
            assert.notOk(
                map.el.querySelector(".leaflet-pane .leaflet-popup-pane").children.length,
                "The popup div should be empty"
            );

            await click(map.el, "div.leaflet-marker-icon");
            assert.strictEqual(
                map.el.querySelector(".leaflet-popup-pane").children.length,
                1,
                "The popup div should contain one element"
            );

            await click(map.el, ".leaflet-map-pane");
            // wait for the popup's destruction which takes a certain time...
            for (let i = 0; i < 15; i++) {
                await nextTick();
            }
            assert.notOk(
                map.el.querySelector(".leaflet-pane .leaflet-popup-pane").children.length,
                "The popup div should be empty"
            );
        }
    );

    /**
     * data: two located records
     * asserts that all the records are shown on the map
     */
    QUnit.test("assert that all the records are shown on the map", async function (assert) {
        assert.expect(3);
        patchWithCleanup(session, { map_box_token: MAP_BOX_TOKEN });
        const map = await makeView({
            config: { views: [] },
            serverData,
            type: "map",
            resModel: "project.task",
            arch: `<map res_partner="partner_id" routing="1" />`,
            async mockRPC(route) {
                switch (route) {
                    case "/web/dataset/call_kw/project.task/web_search_read":
                        return serverData.models["project.task"].twoRecords;
                    case "/web/dataset/call_kw/res.partner/search_read":
                        return serverData.models["res.partner"].twoRecordsAddressNoCoordinates;
                }
            },
        });
        const mapX = map.el.querySelector(".leaflet-map-pane")._leaflet_pos.x;
        const mapY = map.el.querySelector(".leaflet-map-pane")._leaflet_pos.y;
        assert.ok(
            mapX - map.el.querySelector("div.leaflet-marker-icon")._leaflet_pos.x < 0,
            "If the marker is currently shown on the map, the subtraction of latitude should be under 0"
        );
        assert.ok(mapY - map.el.querySelector("div.leaflet-marker-icon")._leaflet_pos.y < 0);
        assert.strictEqual(
            map.el.querySelector("div.leaflet-marker-icon .o-map-renderer--marker-badge")
                .textContent,
            "2",
            "There should be a marker for two records"
        );
    });

    /**
     * data: two located records
     * asserts that the right fields are shown in the popup
     */
    QUnit.test("Content of the marker popup with one field", async function (assert) {
        assert.expect(5);
        patchWithCleanup(session, { map_box_token: MAP_BOX_TOKEN });
        const map = await makeView({
            config: { views: [[false, "form"]] },
            serverData,
            type: "map",
            resModel: "project.task",
            arch: `
                <map res_partner="partner_id" routing="1" hide_name="1" hide_address="1">
                    <field name="display_name" string="Name" />
                </map>
            `,
            async mockRPC(route) {
                switch (route) {
                    case "/web/dataset/call_kw/project.task/web_search_read":
                        return serverData.models["project.task"].oneRecord;
                    case "/web/dataset/call_kw/res.partner/search_read":
                        return serverData.models["res.partner"].twoRecordsAddressCoordinates;
                }
            },
        });
        assert.strictEqual(map.model.metaData.fieldNamesMarkerPopup[0].fieldName, "display_name");

        await click(map.el, "div.leaflet-marker-icon");

        assert.strictEqual(
            map.model.metaData.fieldNamesMarkerPopup.length,
            1,
            "fieldsMarkerPopup should contain one field"
        );
        assert.containsOnce(map.el, "tbody tr", "The popup should have one field");
        assert.strictEqual(
            map.el.querySelector("tbody tr").textContent,
            "NameFoo",
            "Field row's text should be 'Name Foo'"
        );
        assert.strictEqual(
            map.el.querySelector(".o-map-renderer--popup-buttons").children.length,
            3,
            "The popup should contain 2 buttons and one divider"
        );
    });

    /**
     * data: two located records
     * asserts that no field is shown in popup
     */
    QUnit.test("Content of the marker with no field", async function (assert) {
        assert.expect(2);
        patchWithCleanup(session, { map_box_token: MAP_BOX_TOKEN });
        const map = await makeView({
            config: { views: [[false, "form"]] },
            serverData,
            type: "map",
            resModel: "project.task",
            arch: `<map res_partner="partner_id" routing="1" hide_name="1" hide_address="1" />`,
            async mockRPC(route) {
                switch (route) {
                    case "/web/dataset/call_kw/project.task/web_search_read":
                        return serverData.models["project.task"].twoRecords;
                    case "/web/dataset/call_kw/res.partner/search_read":
                        return serverData.models["res.partner"].twoRecordsAddressNoCoordinates;
                }
            },
        });
        await click(map.el, "div.leaflet-marker-icon");

        assert.strictEqual(
            map.el.querySelector("tbody").children.length,
            0,
            "The popup should have only the button"
        );
        assert.strictEqual(
            map.el.querySelector(".o-map-renderer--popup-buttons").children.length,
            3,
            "The popup should contain 2 buttons and one divider"
        );
    });

    QUnit.test("Attribute: hide_name", async function (assert) {
        assert.expect(2);
        patchWithCleanup(session, { map_box_token: MAP_BOX_TOKEN });
        const map = await makeView({
            config: { views: [] },
            serverData,
            type: "map",
            resModel: "project.task",
            arch: `<map res_partner="partner_id" routing="1" hide_name="1" />`,
            async mockRPC(route) {
                switch (route) {
                    case "/web/dataset/call_kw/project.task/web_search_read":
                        return serverData.models["project.task"].twoRecords;
                    case "/web/dataset/call_kw/res.partner/search_read":
                        return serverData.models["res.partner"].twoRecordsAddressCoordinates;
                }
            },
        });

        await click(map.el, "div.leaflet-marker-icon");

        assert.containsOnce(map.el, "tbody > tr", "The popup should have one field");
        assert.strictEqual(
            map.el
                .querySelector("tbody tr .o-map-renderer--popup-table-content-name")
                .textContent.trim(),
            "Address",
            "The popup should have address field"
        );
    });

    QUnit.test("Render partner address field in popup", async function (assert) {
        assert.expect(3);
        patchWithCleanup(session, { map_box_token: MAP_BOX_TOKEN });
        const map = await makeView({
            config: { views: [] },
            serverData,
            type: "map",
            resModel: "project.task",
            arch: `<map res_partner="partner_id" routing="1" hide_name="1" />`,
            async mockRPC(route) {
                switch (route) {
                    case "/web/dataset/call_kw/project.task/web_search_read":
                        return serverData.models["project.task"].oneRecord;
                    case "/web/dataset/call_kw/res.partner/search_read":
                        return serverData.models["res.partner"].oneLocatedRecord;
                }
            },
        });

        await click(map.el, "div.leaflet-marker-icon");

        assert.containsOnce(map.el, "tbody tr", "The popup should have one field");
        assert.strictEqual(
            map.el
                .querySelector("tbody tr .o-map-renderer--popup-table-content-name")
                .textContent.trim(),
            "Address",
            "The popup should have address field"
        );
        assert.strictEqual(
            map.el
                .querySelector("tbody tr .o-map-renderer--popup-table-content-value")
                .textContent.trim(),
            "Chaussée de Namur 40, 1367, Ramillies",
            "The popup should have correct address"
        );
    });

    QUnit.test("Hide partner address field in popup", async function (assert) {
        assert.expect(3);
        patchWithCleanup(session, { map_box_token: MAP_BOX_TOKEN });
        const map = await makeView({
            config: { views: [] },
            serverData,
            type: "map",
            resModel: "project.task",
            arch: `<map res_partner="partner_id" routing="1" hide_address="1" />`,
            async mockRPC(route) {
                switch (route) {
                    case "/web/dataset/call_kw/project.task/web_search_read":
                        return serverData.models["project.task"].oneRecord;
                    case "/web/dataset/call_kw/res.partner/search_read":
                        return serverData.models["res.partner"].oneLocatedRecord;
                }
            },
        });

        await click(map.el, "div.leaflet-marker-icon");

        assert.containsOnce(map.el, "tbody tr", "The popup should have one field");
        assert.strictEqual(
            map.el
                .querySelector("tbody tr .o-map-renderer--popup-table-content-name")
                .textContent.trim(),
            "Name",
            "The popup should have name field"
        );
        assert.strictEqual(
            map.el
                .querySelector("tbody tr .o-map-renderer--popup-table-content-value")
                .textContent.trim(),
            "Foo",
            "The popup should have correct address"
        );
    });

    QUnit.test("Handle records of same co-ordinates in marker", async function (assert) {
        assert.expect(4);
        patchWithCleanup(session, { map_box_token: MAP_BOX_TOKEN });
        const map = await makeView({
            config: { views: [] },
            serverData,
            type: "map",
            resModel: "project.task",
            arch: `<map res_partner="partner_id" />`,
            async mockRPC(route) {
                switch (route) {
                    case "/web/dataset/call_kw/project.task/web_search_read":
                        return serverData.models["project.task"].twoRecords;
                    case "/web/dataset/call_kw/res.partner/search_read":
                        return serverData.models["res.partner"].twoRecordsAddressCoordinates;
                }
            },
        });

        assert.containsOnce(map.el, "div.leaflet-marker-icon", "There should be a one marker");
        assert.strictEqual(
            map.el.querySelector("div.leaflet-marker-icon .o-map-renderer--marker-badge")
                .textContent,
            "2",
            "There should be a marker for two records"
        );

        await click(map.el, "div.leaflet-marker-icon");

        assert.containsOnce(map.el, "tbody tr", "The popup should have one field");
        assert.strictEqual(
            map.el
                .querySelector("tbody tr .o-map-renderer--popup-table-content-name")
                .textContent.trim(),
            "Address",
            "The popup should have address field"
        );
    });

    QUnit.test("Pager", async function (assert) {
        assert.expect(4);
        patchWithCleanup(session, { map_box_token: MAP_BOX_TOKEN });
        const map = await makeView({
            config: { views: [] },
            serverData,
            type: "map",
            resModel: "project.task",
            arch: `<map res_partner="partner_id" />`,
            async mockRPC(route) {
                switch (route) {
                    case "/web/dataset/call_kw/project.task/web_search_read":
                        return {
                            length: 101,
                            records: Array.from({ length: 101 }, (_, index) => {
                                return {
                                    id: index,
                                    name: "project",
                                    partner_id: [index],
                                };
                            }),
                        };
                    case "/web/dataset/call_kw/res.partner/search_read":
                        return Array.from({ length: 101 }, (_, index) => ({
                            id: index,
                            name: "Foo",
                            partner_latitude: 10.0,
                            partner_longitude: 10.5,
                        }));
                }
            },
        });
        assert.containsOnce(map.el, ".o_pager");
        assert.strictEqual(
            map.el.querySelector(`.o_pager_counter .o_pager_value`).textContent.trim(),
            "1-80",
            "current pager value should be 1-20"
        );
        assert.strictEqual(
            map.el.querySelector(`.o_pager_counter span.o_pager_limit`).innerText.trim(),
            "101",
            "current pager limit should be 21"
        );

        await click(map.el.querySelector(`.o_pager button.o_pager_next`));

        assert.strictEqual(
            map.el.querySelector(`.o_pager_counter .o_pager_value`).textContent.trim(),
            "81-101",
            "pager value should be 21-40"
        );
    });

    QUnit.test("New domain", async function (assert) {
        assert.expect(13);
        patchWithCleanup(session, { map_box_token: MAP_BOX_TOKEN });
        serverData.models["project.task"].records = [
            { id: 1, name: "FooProject", sequence: 1, partner_id: 1 },
            { id: 2, name: "BarProject", sequence: 2, partner_id: 2 },
        ];
        const map = await makeView({
            config: { views: [] },
            serverData,
            type: "map",
            resModel: "project.task",
            arch: `<map res_partner="partner_id" routing="1" />`,
            async mockRPC(route) {
                switch (route) {
                    case "/web/dataset/call_kw/res.partner/search_read":
                        return serverData.models["res.partner"].twoRecordsAddressCoordinates;
                }
            },
        });
        assert.strictEqual(map.model.data.records.length, 2, "There should be 2 records");
        assert.containsOnce(
            map.el.querySelector(".leaflet-overlay-pane"),
            "path",
            "There should be one route displayed"
        );
        assert.strictEqual(
            map.el.querySelector("div.leaflet-marker-icon .o-map-renderer--marker-badge")
                .textContent,
            "2",
            "There should be a marker for two records"
        );

        map.env.searchModel.setDomainParts({
            test: {
                domain: [["name", "=", "FooProject"]],
            },
        });
        await nextTick();

        assert.strictEqual(map.model.data.records.length, 1, "There should be 1 record");
        assert.containsNone(
            map.el.querySelector(".leaflet-overlay-pane"),
            "path",
            "There should be no route on the map"
        );
        assert.containsOnce(map, "div.leaflet-marker-icon", "There should be 1 marker on the map");

        map.env.searchModel.setDomainParts({
            test: {
                domain: [["name", "=", "Foofezfezf"]],
            },
        });
        await nextTick();

        assert.strictEqual(map.model.data.records.length, 0, "There should be no record");
        assert.containsNone(
            map.el.querySelector(".leaflet-overlay-pane"),
            "path",
            "There should be no route on the map"
        );
        assert.containsNone(map, "div.leaflet-marker-icon", "There should be 0 marker on the map");

        map.env.searchModel.setDomainParts({
            test: {
                domain: [["name", "like", "Project"]],
            },
        });
        await nextTick();

        assert.strictEqual(map.model.data.records.length, 2, "There should be 2 record");
        assert.containsOnce(
            map.el.querySelector(".leaflet-overlay-pane"),
            "path",
            "There should be 1 route on the map"
        );
        assert.containsOnce(map, "div.leaflet-marker-icon", "There should be 1 marker on the map");
        assert.strictEqual(
            map.el.querySelector("div.leaflet-marker-icon .o-map-renderer--marker-badge")
                .textContent,
            "2",
            "There should be a marker for two records"
        );
    });

    QUnit.test("Toggle grouped pin lists", async function (assert) {
        assert.expect(13);
        patchWithCleanup(session, { map_box_token: MAP_BOX_TOKEN });
        const records = serverData.models["project.task"].threeRecords;
        const partners = serverData.models["res.partner"].twoRecordsAddressCoordinates;
        for (const record of records.records) {
            // add name on partner_id to have name_get like value
            record.partner_id.push(partners.find((x) => x.id === record.partner_id[0]).name);
        }
        const map = await makeView({
            config: { views: [] },
            serverData,
            type: "map",
            resModel: "project.task",
            arch: `<map res_partner="partner_id" />`,
            async mockRPC(route) {
                switch (route) {
                    case "/web/dataset/call_kw/project.task/web_search_read":
                        return records;
                    case "/web/dataset/call_kw/res.partner/search_read":
                        return partners;
                }
            },
            groupBy: ["partner_id"],
        });

        assert.containsN(
            map.el,
            ".o-map-renderer--pin-list-group-header",
            2,
            "Should have 2 groups"
        );
        const groupHeaders = Array.from(
            map.el.querySelectorAll(".o-map-renderer--pin-list-group-header")
        );
        assert.deepEqual(
            groupHeaders.map((gh) => gh.innerText),
            ["Bar", "Foo"]
        );
        assert.containsN(map.el, ".o-map-renderer--pin-list-details", 2);
        assert.containsN(map.el, ".o-map-renderer--pin-list-details li", 3);
        let details = Array.from(map.el.querySelectorAll(".o-map-renderer--pin-list-details"));
        assert.deepEqual(
            details.map((d) => d.innerText),
            ["FooProject\nFooBarProject", "BarProject"]
        );

        await click(map.el.querySelectorAll(".o-map-renderer--pin-list-group-header")[1]);

        assert.containsN(
            map.el,
            ".o-map-renderer--pin-list-group-header",
            2,
            "Should still have 2 groups"
        );
        assert.containsOnce(map.el, ".o-map-renderer--pin-list-details");
        assert.containsN(map.el, ".o-map-renderer--pin-list-details li", 2);
        details = Array.from(map.el.querySelectorAll(".o-map-renderer--pin-list-details"));
        assert.deepEqual(
            details.map((d) => d.innerText),
            ["FooProject\nFooBarProject"]
        );

        await click(map.el.querySelectorAll(".o-map-renderer--pin-list-group-header")[0]);

        assert.containsNone(map.el, ".o-map-renderer--pin-list-details");

        await click(map.el.querySelectorAll(".o-map-renderer--pin-list-group-header")[1]);

        assert.containsOnce(map.el, ".o-map-renderer--pin-list-details");
        assert.containsOnce(map.el, ".o-map-renderer--pin-list-details li");
        details = Array.from(map.el.querySelectorAll(".o-map-renderer--pin-list-details"));
        assert.deepEqual(
            details.map((d) => d.innerText),
            ["BarProject"]
        );
    });

    QUnit.test("Change groupBy", async function (assert) {
        assert.expect(13);
        patchWithCleanup(session, { map_box_token: MAP_BOX_TOKEN });
        const records = serverData.models["project.task"].threeRecords;
        const partners = serverData.models["res.partner"].twoRecordsAddressCoordinates;
        for (const record of records.records) {
            // add name on partner_id to have name_get like value
            record.partner_id.push(partners.find((x) => x.id === record.partner_id[0]).name);
        }
        const map = await makeView({
            config: { views: [] },
            serverData,
            type: "map",
            resModel: "project.task",
            arch: `<map res_partner="partner_id" />`,
            async mockRPC(route) {
                switch (route) {
                    case "/web/dataset/call_kw/project.task/web_search_read":
                        return records;
                    case "/web/dataset/call_kw/res.partner/search_read":
                        return partners;
                }
            },
            searchViewId: false,
            searchViewArch: `
                <search>
                    <filter string="Partner" name="partner_id" context="{'group_by': 'partner_id'}"/>
                    <filter string="Name" name="display_name" context="{'group_by': 'display_name'}"/>
                </search>
            `,
        });

        assert.containsNone(
            map.el,
            ".o-map-renderer--pin-list-group-header",
            "Should not have any groups"
        );

        await toggleGroupByMenu(map);
        await toggleMenuItem(map, "Partner");

        assert.containsN(
            map.el,
            ".o-map-renderer--pin-list-group-header",
            2,
            "Should have 2 groups"
        );
        let groupHeaders = Array.from(
            map.el.querySelectorAll(".o-map-renderer--pin-list-group-header")
        );
        assert.deepEqual(
            groupHeaders.map((gh) => gh.innerText),
            ["Bar", "Foo"]
        );
        // Groups should be loaded too
        assert.containsN(map.el, ".o-map-renderer--pin-list-details li", 3);
        let details = Array.from(map.el.querySelectorAll(".o-map-renderer--pin-list-details"));
        assert.deepEqual(
            details.map((d) => d.innerText),
            ["FooProject\nFooBarProject", "BarProject"]
        );

        await toggleMenuItem(map, "Name");

        groupHeaders = Array.from(
            map.el.querySelectorAll(".o-map-renderer--pin-list-group-header")
        );
        assert.deepEqual(
            groupHeaders.map((gh) => gh.innerText),
            ["Bar", "Foo"],
            "Should not have changed"
        );
        details = Array.from(map.el.querySelectorAll(".o-map-renderer--pin-list-details"));
        assert.deepEqual(
            details.map((d) => d.innerText),
            ["FooProject\nFooBarProject", "BarProject"]
        );

        await toggleMenuItem(map, "Partner");

        assert.containsN(
            map.el,
            ".o-map-renderer--pin-list-group-header",
            3,
            "Should have 3 groups"
        );
        groupHeaders = Array.from(
            map.el.querySelectorAll(".o-map-renderer--pin-list-group-header")
        );
        assert.deepEqual(
            groupHeaders.map((gh) => gh.innerText),
            ["FooProject", "BarProject", "FooBarProject"]
        );
        details = Array.from(map.el.querySelectorAll(".o-map-renderer--pin-list-details"));
        assert.deepEqual(
            details.map((d) => d.innerText),
            ["FooProject", "BarProject", "FooBarProject"]
        );
        assert.containsOnce(map.el.querySelectorAll(".o-map-renderer--pin-list-details")[0], "li");
        assert.containsOnce(map.el.querySelectorAll(".o-map-renderer--pin-list-details")[1], "li");
        assert.containsOnce(map.el.querySelectorAll(".o-map-renderer--pin-list-details")[2], "li");
    });

    //--------------------------------------------------------------------------
    // Controller testing
    //--------------------------------------------------------------------------

    QUnit.test("Click on open button switches to form view", async function (assert) {
        assert.expect(7);

        serviceRegistry.add(
            "action",
            {
                start() {
                    return {
                        switchView(name, info) {
                            assert.step("switchView");
                            assert.strictEqual(name, "form", "The view switched to should be form");
                            assert.strictEqual(info.resId, 1, "The record's id should be 1");
                            assert.strictEqual(
                                info.mode,
                                "readonly",
                                "The mode should be readonly"
                            );
                            assert.strictEqual(
                                info.model,
                                "project.task",
                                "The form view should be on the 'project.task' model"
                            );
                        },
                    };
                },
            },
            { force: true }
        );

        const map = await makeView({
            config: { views: [[false, "form"]] },
            serverData,
            type: "map",
            resModel: "project.task",
            arch: `<map res_partner="partner_id" routing="1" />`,
            async mockRPC(route) {
                switch (route) {
                    case "/web/dataset/call_kw/project.task/web_search_read":
                        return serverData.models["project.task"].oneRecord;
                    case "/web/dataset/call_kw/res.partner/search_read":
                        return serverData.models["res.partner"].oneLocatedRecord;
                }
            },
        });

        await click(map.el, "div.leaflet-marker-icon");
        assert.containsOnce(
            map.el,
            "div.leaflet-popup-pane button.btn.btn-primary.o-map-renderer--popup-buttons-open",
            "The button should be present in the dom"
        );
        await click(
            map.el,
            "div.leaflet-popup-pane button.btn.btn-primary.o-map-renderer--popup-buttons-open"
        );
        assert.verifySteps(["switchView"]);
    });

    QUnit.test("Test the lack of open button", async function (assert) {
        assert.expect(1);

        const map = await makeView({
            config: { views: [] },
            serverData,
            type: "map",
            resModel: "project.task",
            arch: `<map res_partner="partner_id"></map>`,
            async mockRPC(route) {
                switch (route) {
                    case "/web/dataset/call_kw/project.task/web_search_read":
                        return serverData.models["project.task"].oneRecord;
                    case "/web/dataset/call_kw/res.partner/search_read":
                        return serverData.models["res.partner"].oneLocatedRecord;
                }
            },
        });

        await click(map.el, "div.leaflet-marker-icon");

        assert.containsNone(
            map.el,
            "div.leaflet-popup-pane button.btn.btn-primary.o-map-renderer--popup-buttons-open",
            "The button should not be present in the dom"
        );
    });

    QUnit.test(
        "attribute panel_title on the arch should display in the pin list",
        async function (assert) {
            assert.expect(1);

            const map = await makeView({
                config: { views: [] },
                serverData,
                type: "map",
                resModel: "project.task",
                arch: `<map res_partner="partner_id" panel_title="AAAAAAAAAAAAAAAAA"></map>`,
                async mockRPC(route) {
                    switch (route) {
                        case "/web/dataset/call_kw/project.task/web_search_read":
                            return serverData.models["project.task"].oneRecord;
                        case "/web/dataset/call_kw/res.partner/search_read":
                            return serverData.models["res.partner"].oneLocatedRecord;
                    }
                },
            });

            assert.strictEqual(
                map.el.querySelector(".o-map-renderer--pin-list-container .o_pin_list_header span")
                    .textContent,
                "AAAAAAAAAAAAAAAAA"
            );
        }
    );

    QUnit.test(
        "Test using a field other than partner_id for the map view",
        async function (assert) {
            assert.expect(1);

            const map = await makeView({
                config: { views: [] },
                serverData,
                type: "map",
                resModel: "project.task",
                arch: `<map res_partner="another_partner_id"></map>`,
                async mockRPC(route) {
                    switch (route) {
                        case "/web/dataset/call_kw/project.task/web_search_read":
                            return serverData.models["project.task"].anotherPartnerId;
                        case "/web/dataset/call_kw/res.partner/search_read":
                            return serverData.models["res.partner"].oneLocatedRecord;
                    }
                },
            });

            await click(map.el, "div.leaflet-marker-icon");

            assert.containsNone(
                map.el,
                "div.leaflet-popup-pane button.btn.btn-primary.o-map-renderer--popup-buttons-open",
                "The button should not be present in the dom"
            );
        }
    );

    QUnit.test("Check Google Maps URL is updating on domain change", async function (assert) {
        assert.expect(2);

        serverData.models["project.task"].records = [
            { id: 1, name: "FooProject", sequence: 1, partner_id: 2 },
            { id: 2, name: "BarProject", sequence: 2, partner_id: 3 },
        ];

        const map = await makeView({
            config: { views: [] },
            serverData,
            type: "map",
            resModel: "project.task",
            arch: `<map res_partner="partner_id"/>`,
            searchViewArch: `
                        <search>
                            <filter name="some_filter" string="FooProject only" domain="[['name', '=', 'FooProject']]"/>
                        </search>`,
        });

        assert.strictEqual(
            map.el.querySelector("a.btn.btn-primary").href,
            "https://www.google.com/maps/dir/?api=1&waypoints=10,10.5|11,11.5",
            "The link's URL initially should contain the coordinates for all records"
        );

        //apply domain and check that the Google Maps URL on the button reflects the changes
        await toggleFilterMenu(map);
        await toggleMenuItem(map, "FooProject only");
        assert.strictEqual(
            map.el.querySelector("a.btn.btn-primary").href,
            "https://www.google.com/maps/dir/?api=1&waypoints=10,10.5",
            "The link's URL after domain is applied should only contain coordinates for filtered records"
        );
    });

    QUnit.test("Check Google Maps URL (routing and multiple records)", async function (assert) {
        assert.expect(1);

        serverData.models["project.task"].records = [
            { id: 1, name: "FooProject", sequence: 1, partner_id: 2 },
            { id: 2, name: "BarProject", sequence: 2, partner_id: 3 },
        ];

        const map = await makeView({
            config: { views: [] },
            serverData,
            type: "map",
            resModel: "project.task",
            arch: `<map res_partner="partner_id" routing="1"/>`,
        });

        assert.strictEqual(
            map.el.querySelector("a.btn.btn-primary").href,
            "https://www.google.com/maps/dir/?api=1&destination=11,11.5&waypoints=10,10.5",
            "The link's URL initially should contain the coordinates for all records"
        );
    });
});
