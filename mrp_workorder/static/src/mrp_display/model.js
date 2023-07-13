/** @odoo-module **/

import { useBus, useService } from "@web/core/utils/hooks";
import { SEARCH_KEYS } from "@web/search/with_search/with_search";
import { Model } from "@web/model/model";
import { RelationalModel } from "@web/model/relational_model/relational_model";

import { onWillStart, onWillUpdateProps, useComponent } from "@odoo/owl";

/**
 * @typedef {import("@web/search/search_model").SearchParams} SearchParams
 */

/**
 * @param {Object} props
 * @returns {SearchParams}
 */
export function getSearchParams(model, props, component) {
    const params = {};
    for (const key of SEARCH_KEYS) {
        if (model.config.resModel == props.resModel) {
            params[key] = props[key];
        } else {
            if (key == "domain") {
                const production_ids = component.mrp_production.root.records.map((r) => r.resId);
                if (model.config.resModel === "mrp.workorder") {
                    params[key] = [
                        ["production_id", "in", production_ids],
                    ];
                    if (!props.context.show_all_workorders) {
                        if (props.context.show_ready_workorders) {
                            params[key].push(["state", "=", "ready"]);
                        } else if (props.context.show_progress_workorders) {
                            params[key].push(["state", "=", "progress"]);
                        } else {
                            params[key].push(["state", "in", ["ready", "progress", "done"]]);
                        }
                    }
                } else if (model.config.resModel === "stock.move") {
                    params[key] = [
                        "&",
                        ["scrapped", "=", false],
                        "|",
                        ["production_id", "in", production_ids],
                        ["raw_material_production_id", "in", production_ids],
                    ];
                } else if (model.config.resModel === "quality.check") {
                    params[key] = [
                        ["production_id", "in", production_ids],
                    ];
                }
                continue;
            }else if (key === "orderBy" && model.config.resModel === "mrp.workorder"){
                params[key] = [{name: 'state', asc: true}, {name: 'date_start', asc: true}];
                continue;
            }
            // TODO handle domain of submodel here
            params[key] = [];
        }
    }
    return params;
}

/**
 * @template {typeof Model} T
 * @param {T} ModelClass
 * @param {Object} params
 * @param {Object} [options]
 * @param {Function} [options.onUpdate]
 * @returns {InstanceType<T>}
 */
export function useModels(ModelClass, paramsList, options = {}) {
    const component = useComponent();
    if (!(ModelClass.prototype instanceof Model)) {
        throw new Error(`the model class should extend Model`);
    }
    const services = {};
    for (const key of ModelClass.services) {
        services[key] = useService(key);
    }
    services.orm = services.orm || useService("orm");

    const models = [];
    for (const params of paramsList) {
        const model = new ModelClass(component.env, params, services);
        useBus(
            model.bus,
            "update",
            options.onUpdate ||
                (() => {
                    component.render(true); // FIXME WOWL reactivity
                })
        );
        models.push(model);
    }

    async function load(props) {
        for (const model of models) {
            const searchParams = getSearchParams(model, props, component);
            await model.load(searchParams);
        }
    }

    onWillStart(async () => {
        await load(component.props);
    });

    onWillUpdateProps((nextProps) => {
        load(nextProps);
    });

    return models;
}

export class MESRelationalModel extends RelationalModel {
    notify() {
        if (this.skipNextRefresh) {
            this.skipNextRefresh = false;
            return;
        }
        super.notify(...arguments);
    }
}
