/** @odoo-module */

import { _t } from "@web/core/l10n/translation";
const { EventBus } = owl;

/**
 * @typedef {Object} ListMetaData
 * @property {Array<string>} columns
 * @property {string} resModel
 *
 * @typedef {Object} ListSearchParams
 * @property {Array<string>} orderBy
 * @property {Object} domain
 * @property {Object} context
 */

export class SpreadsheetListModel extends EventBus {
    /**
     * @param {Object} params
     * @param {number} params.limit
     * @param {ListMetaData} params.metaData
     * @param {ListSearchParams} params.searchParams
     * @param {Object} services
     * @param {any} services.orm
     * @param {import("../o_spreadsheet/metadata_repository").MetadataRepository} services.metadataRepository
     */
    constructor(params, services) {
        super();
        this.orm = services.orm;
        this.metadataRepository = services.metadataRepository;
        this.metaData = params.metaData;
        this.limit = params.limit;
        this._fetchingPromise = undefined;
    }

    async load(searchParams) {
        if (this.limit === 0) {
            this.data = [];
            return;
        }
        this.data = await this.orm.searchRead(
            this.metaData.resModel,
            searchParams.domain,
            this.metaData.columns.filter(f => this.getField(f)),
            {
                orderBy: searchParams.orderBy,
                limit: this.limit,
            },
            searchParams.context
        );
    };

    //--------------------------------------------------------------------------
    // Evaluation
    //--------------------------------------------------------------------------

    /**
     * Get the value of a fieldName for the record at the given position.
     * @param {number} position
     * @param {string} fieldName
     *
     * @returns {string|undefined}
     */
    getListCellValue(position, fieldName) {
        if (position >= this.limit) {
            this.limit = position + 1;
            // A reload is needed because the asked position is not already loaded.
            this._triggerFetching();
            return _t("Loading...");
        }
        const record = this.data[position];
        if (!record) {
            return "";
        }
        const field = this.getField(fieldName);
        if (!field) {
            throw new Error(_.str.sprintf(_t("The field %s does not exist or you do not have access to that field"), fieldName));
        }
        if (!(fieldName in record)) {
            this.metaData.columns.push(fieldName);
            this.metaData.columns = [...new Set(this.metaData.columns)]; //Remove duplicates
            this._triggerFetching();
            return undefined;
        }
        switch (field.type) {
            case "many2one":
                return record[fieldName].length === 2 ? record[fieldName][1] : "";
            case "one2many":
            case "many2many":
                const labels = record[fieldName].map((id) => this.metadataRepository.getRecordDisplayName(field.relation, id)).filter((value) => value !== undefined);
                return labels.join(", ");
            case "selection":
                const key = record[fieldName]
                const value = field.selection.find((array) => array[0] === key);
                return value ? value[1] : "";
            case "boolean":
                return record[fieldName] ? "TRUE" : "FALSE";
            default:
                return record[fieldName] || "";
        }
    }

    /**
     * Get the value for a list header
     * @param {string} fieldName Name of the field
     * @returns {string}
     */
    getListHeaderValue(fieldName) {
        const field = this.getField(fieldName);
        return field ? field.string : fieldName;
    }

    //--------------------------------------------------------------------------
    // Metadata getters
    //--------------------------------------------------------------------------

    /**
     * @returns {string} Display name of the model
     */
    getModelLabel() {
        return this.metaData.modelLabel;
    }

    /**
     * @returns {Object} List of fields
     */
    getFields() {
        return this.metaData.fields;
    }

    /**
     * @param {string} field Field name
     * @returns {Object | undefined} Field
     */
    getField(field) {
        return this.metaData.fields[field];
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Ask the parent data source to force a reload of this data source in the
     * next clock cycle. It's necessary when this.limit was updated and new
     * records have to be fetched.
     */
    _triggerFetching() {
        if (this._fetchingPromise) {
            return;
        }
        this._fetchingPromise = Promise.resolve().then(() => {
            new Promise((resolve) => {
                this.trigger("limit-exceeded");
                this._fetchingPromise = undefined;
                resolve();
            });
        });
    }
}
