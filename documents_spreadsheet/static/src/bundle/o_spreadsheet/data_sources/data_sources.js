/** @odoo-module */

import { MetadataRepository } from "../metadata_repository";

const { EventBus } = owl;

/**
 * @typedef {import("./data_source").DataSource} DataSource
 */


export class DataSources extends EventBus {

    constructor(orm) {
        super();
        this._orm = orm;
        this._metadataRepository = new MetadataRepository(orm);
        this._metadataRepository.addEventListener("labels-fetched", () => this.notify());
        /** @type {Object.<string, DataSource>} */
        this._dataSources = {};
    }

    /**
     * Create a new data source but do not register it.
     *
     * @param {Class<DataSource>} cls Class to instantiate
     * @param {Object} params Params to give to data source
     *
     * @returns {DataSource}
     */
    create(cls, params) {
        return new cls({
            orm: this._orm,
            metadataRepository: this._metadataRepository,
            notify: () => this.notify(),
        }, params);
    }


    /**
     * Create a new data source and register it with the following id.
     *
     * @param {string} id
     * @param {Class<DataSource>} cls Class to instantiate
     * @param {Object} params Params to give to data source
     *
     * @returns {DataSource}
     */
    add(id, cls, params) {
        this._dataSources[id] = this.create(cls, params);
        return this._dataSources[id];
    }

    async load(id, reload=false) {
        await this.get(id).load({ reload });
    }

    /**
     * Retrieve the data source with the following id.
     *
     * @param {string} id
     *
     * @returns {DataSource|undefined}
     */
    get(id) {
        return this._dataSources[id];
    }

    /**
     * Get the model of a data source
     *
     * @param {string} id
     * @returns {Object|undefined}
     */
    getDataSourceModel(id) {
        const ds = this._dataSources[id];
        if (!ds) {
            return undefined;
        }
        const model = ds.model;
        if (!model) {
            this.load(id);
        }
        return model;
    }

    /**
     * Check if the following is correspond to a data source.
     *
     * @param {string} id
     *
     * @returns {boolean}
     */
    contains(id) {
        return id in this._dataSources;
    }

    /**
     * Remove the data source with the following id.
     *
     * @param {string} id
     */
    remove(id) {
        this._dataSources[id] = undefined;
    }

    /**
     * Notify that a data source has been updated. Could be useful to
     * request a re-evaluation.
     */
    notify() {
        this.trigger("data-source-updated");
    }

    async waitForAllLoaded() {
        await Promise.all(Object.values(this._dataSources).map((ds) => ds.load()));
    }
}
