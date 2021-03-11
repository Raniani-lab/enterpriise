/** @odoo-module **/

import { useService } from "@web/core/utils/hooks";

export default class LazyBarcodeCache {
    constructor(cacheData) {
        this.rpc = useService('rpc');
        this.dbIdCache = {}; // Cache by model + id
        this.dbBarcodeCache = {}; // Cache by model + barcode
        this.missingBarcode = new Set(); // Used as a cache by `_getMissingRecord`
        this.barcodeFieldByModel = {
            'stock.location': 'barcode',
            'product.product': 'barcode',
            'product.packaging': 'barcode',
            'stock.picking': 'name',
            'stock.quant.package': 'name',
            'stock.production.lot': 'name', // Also ref, should take in account multiple fields ?
        };
        this.setCache(cacheData);
    }

    /**
     * Adds records to the barcode application's cache.
     *
     * @param {Object} cacheData each key is a model's name and contains an array of records.
     */
    setCache(cacheData) {
        for (const model in cacheData) {
            const records = cacheData[model];
            // Adds the model's key in the cache's DB.
            if (!this.dbIdCache.hasOwnProperty(model)) {
                this.dbIdCache[model] = {};
            }
            if (!this.dbBarcodeCache.hasOwnProperty(model)) {
                this.dbBarcodeCache[model] = {};
            }
            // Adds the record in the cache.
            const barcodeField = this._getBarcodeField(model);
            for (const record of records) {
                this.dbIdCache[model][record.id] = record;
                if (barcodeField) {
                    const barcode = record[barcodeField];
                    if (!this.dbBarcodeCache[model][barcode]) {
                        this.dbBarcodeCache[model][barcode] = [];
                    }
                    if (!this.dbBarcodeCache[model][barcode].includes(record.id)) {
                        this.dbBarcodeCache[model][barcode].push(record.id);
                    }
                }
            }
        }
    }

    /**
     * Get record from the cache, throw a error if we don't find in the cache
     * (the server should have return this information).
     *
     * @param {int} id id of the record
     * @param {string} model model_name of the record
     * @param {boolean} [copy=true] if true, returns a deep copy (to avoid to write the cache)
     * @returns copy of the record send by the server (fields limited to _get_fields_stock_barcode)
     */
    getRecord(model, id) {
        if (!this.dbIdCache.hasOwnProperty(model)) {
            throw new Error(`Model ${model} doesn't exist in the cache`);
        }
        if (!this.dbIdCache[model].hasOwnProperty(id)) {
            throw new Error(`Record ${model} with id=${id} doesn't exist in the cache, it should return by the server`);
        }
        const record = this.dbIdCache[model][id];
        return JSON.parse(JSON.stringify(record));
    }

    /**
     * @param {string} barcode barcode to match with a record
     * @param {string} [model] model name of the record to match (if empty search on all models)
     * @param {boolean} [onlyInCache] search only in the cache
     * @param {Object} [filters]
     * @returns copy of the record send by the server (fields limited to _get_fields_stock_barcode)
     */
    async getRecordByBarcode(barcode, model = false, onlyInCache = false, filters = {}) {
        if (model) {
            if (!this.dbBarcodeCache.hasOwnProperty(model)) {
                throw new Error(`Model ${model} doesn't exist in the cache`);
            }
            if (!this.dbBarcodeCache[model].hasOwnProperty(barcode)) {
                if (onlyInCache) {
                    return null;
                }
                await this._getMissingRecord(barcode, model);
                return await this.getRecordByBarcode(barcode, model, true);
            }
            const id = this.dbBarcodeCache[model][barcode][0];
            return this.getRecord(model, id);
        } else {
            const result = new Map();
            // Returns object {model: record} of possible record.
            const models = Object.keys(this.dbBarcodeCache);
            for (const model of models) {
                if (this.dbBarcodeCache[model].hasOwnProperty(barcode)) {
                    const ids = this.dbBarcodeCache[model][barcode];
                    for (const id of ids) {
                        const record = this.dbIdCache[model][id];
                        result.set(model, JSON.parse(JSON.stringify(record)));
                        if (filters[model]) {
                            let pass = true;
                            const fields = Object.keys(filters[model]);
                            for (const field of fields) {
                                if (record[field] != filters[model][field]) {
                                    pass = false;
                                    break;
                                }
                            }
                            if (pass) {
                                break;
                            }
                        }
                    }
                }
            }
            if (result.size < 1) {
                if (onlyInCache) {
                    return result;
                }
                await this._getMissingRecord(barcode, model, filters);
                return await this.getRecordByBarcode(barcode, model, true);
            }
            return result;
        }
    }

    _getBarcodeField(model) {
        if (!this.barcodeFieldByModel.hasOwnProperty(model)) {
            return null;
        }
        return this.barcodeFieldByModel[model];
    }

    async _getMissingRecord(barcode, model, filters) {
        const missCache = this.missingBarcode;
        const params = { barcode, model_name: model };
        // Check if we already try to fetch this missing record.
        if (missCache.has(barcode) || missCache.has(`${barcode}_${model}`)) {
            return false;
        }
        // Creates and passes a domain if some filters are provided.
        if (filters) {
            const domainsByModel = {};
            for (const filter of Object.entries(filters)) {
                const modelName = filter[0];
                const filtersByField = filter[1];
                domainsByModel[modelName] = [];
                for (const filterByField of Object.entries(filtersByField)) {
                    domainsByModel[modelName].push([filterByField[0], '=', filterByField[1]]);
                }
            }
            params.domains_by_model = domainsByModel;
        }
        const result = await this.rpc('/stock_barcode/get_specific_barcode_data', params);
        this.setCache(result);
        // Set the missing cache
        const keyCache = (model && `${barcode}_${model}`) || barcode;
        missCache.add(keyCache);
    }
}
