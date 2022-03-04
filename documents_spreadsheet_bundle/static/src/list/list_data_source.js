/** @odoo-module */

import { Domain } from "@web/core/domain";
import spreadsheet from "../o_spreadsheet/o_spreadsheet_extended";
import { removeContextUserInfo } from "@documents_spreadsheet/helpers";
import { SpreadsheetListModel } from "./list_model";

const { DataSource } = spreadsheet;

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/**
 * @typedef {import("./basic_data_source").Field} Field
 */

export default class ListDataSource extends DataSource {
    /**
     * @override
     *
     * @param {Object} params
     */
    constructor(params) {
        super(params);
        this.odooViewsModels = params.odooViewsModels;
        this.metadataRepository = this.odooViewsModels.metadataRepository;
        this.definition = JSON.parse(JSON.stringify(params.definition));
        this.limit = this.definition.limit;
        delete this.definition.limit;
        this.computedDomain = this.definition.searchParams.domain;
        this.context = removeContextUserInfo(this.definition.searchParams.context)
        this.model = undefined;
    }

    /**
     * Get the computed domain of this source
     * @returns {Array}
     */
    getComputedDomain() {
        return this.computedDomain;
    }

    addDomain(domain) {
        this.computedDomain = Domain.and([this.definition.searchParams.domain, domain]).toList();
    }

    async _fetchMetadata() {
        if (!this.definition.metaData.fields) {
            this.definition.metaData.fields = await this.metadataRepository.fieldsGet(
                this.definition.metaData.model
            );
        }
        if (!this.definition.metaData.modelLabel) {
            this.definition.metaData.modelLabel = await this.metadataRepository.modelDisplayName(
                this.definition.metaData.model
            );
        }
        this.model = this.odooViewsModels.createModel(SpreadsheetListModel, { definition: this.definition, limit: this.limit });
        this.model.addEventListener("limit-exceeded", () => this.get({ forceFetch: true }));
        return this.definition.metaData;
    }

    async _fetch() {
        const searchParams = {
            ...this.definition.searchParams,
            context: this.context,
            domain: this.computedDomain,
        };
        await this.model.load(searchParams);
        return this.model;
    }

    getListModel() {
        return this.model;
    }

}
