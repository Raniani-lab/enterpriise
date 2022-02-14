/** @odoo-module */

import { Domain } from "@web/core/domain";
import spreadsheet from "../o_spreadsheet/o_spreadsheet_extended";
import { SpreadsheetPivotModel } from "./pivot_model";
import { removeContextUserInfo } from "@documents_spreadsheet/helpers";

const { DataSource } = spreadsheet;

export default class PivotDataSource extends DataSource {
    constructor(params) {
        super(params);
        this.odooViewsModels = params.odooViewsModels;
        this.metadataRepository = this.odooViewsModels.metadataRepository;
        this.definition = JSON.parse(JSON.stringify(params.definition));
        this.computedDomain = this.definition.searchParams.domain;
        this.context = removeContextUserInfo(this.definition.context);
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
                this.definition.metaData.resModel
            );
        }
        if (!this.definition.metaData.modelLabel) {
            this.definition.metaData.modelLabel = await this.metadataRepository.modelDisplayName(
                this.definition.metaData.resModel
            );
        }
        this.model = this.odooViewsModels.createModel(SpreadsheetPivotModel, this.definition);
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

    getPivotModel() {
        return this.model;
    }
}
