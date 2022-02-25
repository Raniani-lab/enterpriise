/** @odoo-module **/

import { useAssets } from "@web/core/assets";
import { _lt } from "@web/core/l10n/translation";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { useModel } from "@web/views/helpers/model";
import { standardViewProps } from "@web/views/helpers/standard_view_props";
import { useSetupView } from "@web/views/helpers/view_hook";
import { Layout } from "@web/views/layout";
import { usePager } from "@web/search/pager_hook";
import { MapArchParser } from "./map_arch_parser";
import { MapModel } from "./map_model";
import { MapRenderer } from "./map_renderer";
import { LegacyComponent } from "@web/legacy/legacy_component";

const { Component, onWillUnmount } = owl;

export class MapView extends LegacyComponent {
    setup() {
        this.action = useService("action");

        let modelParams = this.props.state;
        if (!modelParams) {
            /** @type {typeof MapArchParser} */
            const ArchParser = this.constructor.ArchParser;
            const parser = new ArchParser();
            const archInfo = parser.parse(this.props.arch);
            const views = this.env.config.views || [];
            modelParams = {
                context: this.props.context,
                defaultOrder: archInfo.defaultOrder,
                fieldNames: archInfo.fieldNames,
                fieldNamesMarkerPopup: archInfo.fieldNamesMarkerPopup,
                fields: this.props.fields,
                hasFormView: views.some((view) => view[1] === "form"),
                hideAddress: archInfo.hideAddress || false,
                hideName: archInfo.hideName || false,
                hideTitle: archInfo.hideTitle || false,
                limit: archInfo.limit || 80,
                numbering: archInfo.routing || false,
                offset: 0,
                panelTitle:
                    archInfo.panelTitle || this.env.config.getDisplayName() || this.env._t("Items"),
                resModel: this.props.resModel,
                resPartnerField: archInfo.resPartnerField,
                routing: archInfo.routing || false,
            };
        }

        /** @type {typeof MapModel} */
        const Model = this.constructor.Model;
        const model = useModel(Model, modelParams);
        this.model = model;

        onWillUnmount(() => {
            this.model.stopFetchingCoordinates();
        });

        useSetupView({
            getLocalState: () => {
                return this.model.metaData;
            },
        });

        useAssets({
            jsLibs: ["/web_map/static/lib/leaflet/leaflet.js"],
            cssLibs: ["/web_map/static/lib/leaflet/leaflet.css"],
        });

        usePager(() => {
            return {
                offset: this.model.metaData.offset,
                limit: this.model.metaData.limit,
                total: this.model.data.count,
                onUpdate: ({ offset, limit }) => this.model.load({ offset, limit }),
            };
        });
    }

    /**
     * @returns {any}
     */
    get rendererProps() {
        return {
            model: this.model,
            onMarkerClick: this.openRecords.bind(this),
        };
    }
    /**
     * @returns {string}
     */
    get googleMapUrl() {
        let url = "https://www.google.com/maps/dir/?api=1";
        if (this.model.data.records.length) {
            const allCoordinates = this.model.data.records.filter(
                ({ partner }) => partner && partner.partner_latitude && partner.partner_longitude
            );
            const uniqueCoordinates = allCoordinates.reduce((coords, { partner }) => {
                const coord = partner.partner_latitude + "," + partner.partner_longitude;
                if (!coords.includes(coord)) {
                    coords.push(coord);
                }
                return coords;
            }, []);
            if (uniqueCoordinates.length && this.model.metaData.routing) {
                // When routing is enabled, make last record the destination
                url += `&destination=${uniqueCoordinates.pop()}`;
            }
            if (uniqueCoordinates.length) {
                url += `&waypoints=${uniqueCoordinates.join("|")}`;
            }
        }
        return url;
    }

    /**
     * Redirects to views when clicked on open button in marker popup.
     *
     * @param {number[]} ids
     */
    openRecords(ids) {
        if (ids.length > 1) {
            this.action.doAction({
                type: "ir.actions.act_window",
                name: this.env.config.getDisplayName() || this.env._t("Untitled"),
                views: [
                    [false, "list"],
                    [false, "form"],
                ],
                res_model: this.props.resModel,
                domain: [["id", "in", ids]],
            });
        } else {
            this.action.switchView("form", {
                resId: ids[0],
                mode: "readonly",
                model: this.props.resModel,
            });
        }
    }
}

MapView.template = "web_map.MapView";
MapView.buttonTemplate = "web_map.MapView.Buttons";

MapView.components = {
    Layout,
};

MapView.props = {
    ...standardViewProps,
};

MapView.type = "map"; // refer to python view type

MapView.display_name = _lt("Map");
MapView.icon = "oi-map";
MapView.multiRecord = true;

MapView.ArchParser = MapArchParser;
MapView.Model = MapModel;
MapView.Renderer = MapRenderer;

registry.category("views").add("map", MapView);
