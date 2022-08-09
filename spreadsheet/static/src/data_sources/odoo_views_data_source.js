/** @odoo-module */

import { LoadableDataSource } from "./data_source";
import { Domain } from "@web/core/domain";
import { LoadingDataError } from "@spreadsheet/o_spreadsheet/errors";

/**
 * @typedef {import("@spreadsheet/data_sources/metadata_repository").Field} Field
 */

/**
 * Remove user specific info from the context
 * @param {Object} context
 * @returns {Object}
 */
function removeContextUserInfo(context) {
    context = { ...context };
    delete context.allowed_company_ids;
    delete context.tz;
    delete context.lang;
    delete context.uid;
    return context;
}

/**
 * @typedef {Object} OdooModelMetaData
 * @property {string} resModel
 * @property {Array<Object>|undefined} fields
 */

export class OdooViewsDataSource extends LoadableDataSource {
    /**
     * @override
     * @param {Object} services
     * @param {Object} params
     * @param {OdooModelMetaData} params.metaData
     * @param {Object} params.searchParams
     */
    constructor(services, params) {
        super(services);
        this._metaData = JSON.parse(JSON.stringify(params.metaData));
        this._searchParams = JSON.parse(JSON.stringify(params.searchParams));
        this._searchParams.context = removeContextUserInfo(this._searchParams.context);
        this._customDomain = this._searchParams.domain;

        /**
         * The model used by this dataSource
         */
        this._model = undefined;
        /**
         * Promise to control the creation of the model
         */
        this._createModelPromise = undefined;
    }

    async loadMetadata() {
        if (!this._metaData.fields) {
            this._metaData.fields = await this._metadataRepository.fieldsGet(
                this._metaData.resModel
            );
        }
    }

    /**
     * @returns {Record<string, Field>} List of fields
     */
    getFields() {
        if (this._metaData.fields === undefined) {
            this.loadMetadata();
            throw new LoadingDataError();
        }
        return this._metaData.fields;
    }

    /**
     * @param {string} field Field name
     * @returns {Field | undefined} Field
     */
    getField(field) {
        return this._metaData.fields[field];
    }

    async _load() {
        if (!this._model) {
            await this._loadModel();
        }
        const searchParams = {
            ...this._searchParams,
            domain: this._customDomain,
        };
        await this._model.load(searchParams);
    }

    /**
     * @returns {boolean}
     */
    isReady() {
        return this._model !== undefined;
    }

    /*
     * Create a model
     * @private
     * @returns {Promise} Resolved when the model is created
     */
    async _loadModel() {
        if (!this._createModelPromise) {
            this._createModelPromise = this._createDataSourceModel();
        }
        return this._createModelPromise;
    }

    isMetaDataLoaded() {
        return this._metaData.fields !== undefined;
    }

    /**
     * Get the computed domain of this source
     * @returns {Array}
     */
    getComputedDomain() {
        return this._customDomain;
    }

    addDomain(domain) {
        const newDomain = Domain.and([this._searchParams.domain, domain]);
        if (newDomain.toString() === new Domain(this._customDomain).toString()) {
            return;
        }
        this._customDomain = newDomain.toList();
        if (this._loadPromise === undefined) {
            // if the data source has never been loaded, there's no point
            // at reloading it now.
            return;
        }
        this.load({ reload: true });
    }

    /**
     * @returns {Promise<string>} Display name of the model
     */
    getModelLabel() {
        return this._metadataRepository.modelDisplayName(this._metaData.resModel);
    }

    /**
     * @protected
     */
    _assertModel() {
        if (this._model === undefined) {
            this.load();
            throw new LoadingDataError();
        }
    }

    /**
     * Create a model
     *
     * @abstract
     * @protected
     */
    async _createDataSourceModel() {
        throw new Error("This method should be implemented by child class");
    }
}
