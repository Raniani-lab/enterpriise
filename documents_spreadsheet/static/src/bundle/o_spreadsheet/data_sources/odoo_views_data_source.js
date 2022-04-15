/** @odoo-module */

import { DataSource } from "./data_source";
import { Domain } from "@web/core/domain";
import { removeContextUserInfo } from "@documents_spreadsheet/assets/helpers";

/**
 * @typedef {Object} OdooModelMetaData
 * @property {string} resModel
 * @property {Array<Object>|undefined} fields
 * @property {string|undefined} modelLabel
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
        if (!this._metaData.modelLabel) {
            this._metaData.modelLabel = await this._metadataRepository.modelDisplayName(
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
        this.load({ reload: true });
    }
}
