/** @odoo-module */

import { DataSource } from "./data_source";
import { Domain } from "@web/core/domain";
import { LoadingDataError } from "@spreadsheet/o_spreadsheet/errors";

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

export class OdooViewsDataSource extends DataSource {
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
    }

    async _fetchMetadata() {
        if (!this._metaData.fields) {
            this._metaData.fields = await this._metadataRepository.fieldsGet(
                this._metaData.resModel
            );
        }
    }

    async _load() {
        const searchParams = {
            ...this._searchParams,
            domain: this._customDomain,
        };
        await this._model.load(searchParams);
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
}
