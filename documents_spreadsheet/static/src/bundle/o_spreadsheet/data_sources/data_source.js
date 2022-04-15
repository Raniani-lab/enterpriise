/** @odoo-module */

/**
 * DataSource is an abstract class that contains the logic of fetching and
 * maintaining access to data that have to be loaded.
 *
 * A class which extends this class have to implement two different methods:
 * * `_createModel`: This method should be used to instantiate the model used
 * by this dataSource. This method is async in order to be able to fetch some
 * metadata.
 *
 * * `_load`: This method should reload the model
 *
 * To get the data from this class, there is three options:
 * * `get`: async function that will returns the data when it's loaded
 * * `getSync`: get the data that are currently loaded, undefined if no data
 * are loaded
 * * specific method: Subclass can implement concrete method to have access to a
 * particular data.
 */
export class DataSource {
    constructor(services) {
        this._orm = services.orm;
        this._metadataRepository = services.metadataRepository;
        this._notify = services.notify;

        /**
         * The model used by this dataSource
         */
        this._model = undefined;

        /**
         * Last time that this dataSource has been updated
         */
        this._lastUpdate = undefined;

        /**
         * Promise to control the loading of data
         */
        this._loadPromise = undefined;

        /**
         * Promise to control the creation of the model
         */
        this._createModelPromise = undefined;
    }

    /**
     * Create a model
     *
     * @returns {Promise} Resolved when the model is created
     */
    async loadModel() {
        if (!this._createModelPromise) {
            this._createModelPromise = this._createDataSourceModel();
        }
        return this._createModelPromise;
    }

    /**
     * Load data in the model
     * @param {Object} params Params for fetching data
     * @param {boolean=false} params.reload Force the reload of the data
     *
     * @returns {Promise} Resolved when data are fetched.
     */
    async load(params) {
        if (params && params.reload) {
            this._loadPromise = undefined;
        }
        if (!this._model) {
            await this.loadModel();
        }
        if (!this._loadPromise) {
            this._loadPromise = this._load(params).then(() => {
                this._lastUpdate = Date.now();
                this._notify();
            });
        }
        return this._loadPromise;
    }

    get model() {
        return this._model;
    }

    get lastUpdate() {
        return this._lastUpdate;
    }

    /**
     * Create a model
     *
     * @abstract
     * @private
     */
    async _createDataSourceModel() {
        throw new Error("This method should be implemented by child class");
    }

    /**
     * Load the data in the model
     *
     * @abstract
     * @private
     */
    async _load() {
        throw new Error("This method should be implemented by child class");
    }

}
