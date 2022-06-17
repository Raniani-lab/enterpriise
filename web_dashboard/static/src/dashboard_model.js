/** @odoo-module */

import { Domain } from "@web/core/domain";
import { evaluateExpr } from "@web/core/py_js/py";
import { KeepLast } from "@web/core/utils/concurrency";
import { computeVariation } from "@web/core/utils/numbers";
import { Record, RelationalModel } from "@web/views/basic_relational_model";
import { Model } from "@web/views/model";

/**
 * @typedef {import("@web/search/search_model").SearchParams} SearchParams
 */

function getPseudoRecords(meta, data) {
    const records = [];
    for (let i = 0; i < meta.domains.length; i++) {
        const record = {};
        for (const [statName, statInfo] of Object.entries(data)) {
            record[statName] = statInfo.values[i];
        }
        records.push(record);
    }
    return records;
}

function getVariationAsRecords(data) {
    const periods = [];

    Object.entries(data).forEach(([fName, { variations }]) => {
        for (const varIndex in variations) {
            periods[varIndex] = periods[varIndex] || {};
            periods[varIndex][fName] = variations[varIndex];
        }
    });
    return periods;
}

const setupRelationalModel = (model) => {
    const enrichParams = (additionalParams) => ({
        ...additionalParams,
        context: model.metaData.context,
        compare: model.metaData.domains.length > 1,
    });

    // Compute view fields info
    const fieldsInfo = { dashboard: {}, formulas: {} };
    const allFields = { ...model.metaData.fields };
    for (const agg of model.metaData.aggregates) {
        const fakeField = {
            ...agg,
            type: agg.fieldType === "many2one" ? "integer" : agg.fieldType,
        };
        fieldsInfo.dashboard[agg.name] = fakeField;
        allFields[agg.name] = fakeField;
    }
    model.metaData.formulae.forEach((formula, formulaId) => {
        const formulaName = formula.name || `formula_${formulaId + 1}`;
        const fakeField = {
            ...formula,
            type: "float",
            name: formulaName,
        };
        fieldsInfo.dashboard[formulaName] = fakeField;
        fieldsInfo.formulas[formulaName] = fakeField;
        allFields[formulaName] = fakeField;
    });
    fieldsInfo.default = fieldsInfo.dashboard;

    // Make basic relational model
    const modelParams = { resModel: model.metaData.resModel, rootType: "record" };
    const services = { orm: model.orm };
    const relationalModel = new RelationalModel(model.env, modelParams, services);

    // Make basic model
    const legacyModel = relationalModel.__bm__;
    const { __get, _makeDataPoint } = legacyModel;
    let lastDataPointInfo = null;
    legacyModel._makeDataPoint = (params) => _makeDataPoint.call(legacyModel, enrichParams(params));
    legacyModel.__get = (...args) => {
        return {
            ...__get.call(legacyModel, ...args),
            ...lastDataPointInfo,
        };
    };

    // Returns simplified object
    return {
        async makeRecords(data) {
            // Make legacy record
            const [baseRecord, comparisonRecord] = getPseudoRecords(model.metaData, data);
            async function _makeRecord(record) {
                const fields = {};
                Object.keys(model.metaData.statistics).forEach((fieldName) => {
                    fields[fieldName] = fieldsInfo.dashboard[fieldName];
                });
                const handle = await legacyModel.makeRecord(
                    model.metaData.resModel,
                    fieldsInfo.dashboard,
                    fieldsInfo
                );
                const dp = legacyModel.localData[handle];
                dp.data = record;
                dp.domain = model.metaData.domain;
                dp.fields = allFields;
                if (record === baseRecord) {
                    if (model.metaData.domains.length > 1) {
                        const comparison = model.env.searchModel.getFullComparison();
                        lastDataPointInfo = {
                            comparisonData: comparisonRecord,
                            comparisonTimeRange: comparison.comparisonRange,
                            timeRange: comparison.range,
                            timeRanges: comparison,
                            variationData: getVariationAsRecords(data)[0],
                        };
                    } else {
                        lastDataPointInfo = null;
                    }
                }
                // Make wowl record
                const activeFields = {};
                for (const fieldName in fieldsInfo.dashboard) {
                    activeFields[fieldName] = {};
                }
                const recordParams = enrichParams({
                    fields: fieldsInfo.dashboard,
                    activeFields,
                    handle,
                });
                return new Record(relationalModel, recordParams);
            }
            const result = [];
            result.push(await _makeRecord(baseRecord));
            if (comparisonRecord) {
                result.push(await _makeRecord(comparisonRecord));
            }
            return result;
        },
        set useSampleModel(bool) {
            relationalModel.useSampleModel = bool;
        },
    };
};

export class DashboardModel extends Model {
    setup(params) {
        super.setup(...arguments);

        this.keepLast = new KeepLast();

        const { aggregates, fields, formulae, resModel } = params;
        this.metaData = { fields, formulae, resModel };

        this.metaData.aggregates = [];
        for (const agg of aggregates) {
            const enrichedCopy = { ...agg };

            const groupOperator = agg.groupOperator || "sum";
            enrichedCopy.measureSpec = `${agg.name}:${groupOperator}(${agg.field})`;

            const field = fields[agg.field];
            enrichedCopy.fieldType = field.type;

            this.metaData.aggregates.push(enrichedCopy);
        }

        this.metaData.statistics = this._statisticsAsFields();

        this.relationalModel = setupRelationalModel(this);
    }

    /**
     * @param {SearchParams} searchParams
     */
    async load(searchParams) {
        const { comparison, domain, context } = searchParams;
        const metaData = { ...this.metaData, context, domain };
        if (comparison) {
            metaData.domains = comparison.domains;
        } else {
            metaData.domains = [{ arrayRepr: domain, description: null }];
        }
        await this.keepLast.add(this._load(metaData));
        this.relationalModel.useSampleModel = metaData.useSampleModel;
        this.metaData = metaData;

        this.records = await this.keepLast.add(this.relationalModel.makeRecords(this.data));
    }

    /**
     * @override
     */
    hasData() {
        return this.count > 0;
    }

    evalDomain(record, expr) {
        if (!Array.isArray(expr)) {
            return !!expr;
        }
        const domain = new Domain(expr);
        return domain.contains(getPseudoRecords(this.metaData, this.data)[0]);
    }

    /**
     * @param {strnig} statName
     * @returns {Object}
     */
    getStatisticDescription(statName) {
        return this.metaData.statistics[statName];
    }

    //--------------------------------------------------------------------------
    // Protected
    //--------------------------------------------------------------------------

    /**
     * @protected
     * @param {Object} meta
     * @param {Object} data
     */
    _computeVariations(meta, data) {
        const n = meta.domains.length - 1;
        for (const statInfo of Object.values(data)) {
            const { values } = statInfo;
            statInfo.variations = new Array(n);
            for (let i = 0; i < n; i++) {
                statInfo.variations[i] = computeVariation(values[i], values[i + 1]);
            }
        }
    }

    /**
     * @protected
     * @param {Object} meta
     * @param {Object} data
     */
    _evalFormulae(meta, data) {
        const records = getPseudoRecords(meta, data);
        for (const formula of meta.formulae) {
            const { name, operation } = formula;
            data[name] = {
                values: new Array(meta.domains.length).fill(NaN),
            };
            for (let i = 0; i < meta.domains.length; i++) {
                try {
                    const value = evaluateExpr(operation, { record: records[i] });
                    if (isFinite(value)) {
                        data[name].values[i] = value;
                    }
                } catch (_e) {
                    // pass
                }
            }
        }
    }

    /**
     * @protected
     * @param {Object} meta
     */
    async _load(meta) {
        const domainMapping = {};
        if (this.useSampleModel) {
            // force a read_group RPC without domain to determine if there is data to display
            domainMapping["[]"] = [];
        }
        for (const agg of meta.aggregates) {
            const domain = agg.domain || "[]";
            if (domain in domainMapping) {
                domainMapping[domain].push(agg);
            } else {
                domainMapping[domain] = [agg];
            }
        }

        const proms = [];
        const data = {};
        let count = 0;
        for (const [domain, aggregates] of Object.entries(domainMapping)) {
            for (let i = 0; i < meta.domains.length; i++) {
                const { arrayRepr } = meta.domains[i];
                proms.push(
                    this.orm
                        .readGroup(
                            meta.resModel,
                            Domain.and([domain, arrayRepr]).toList(),
                            aggregates.map((agg) => agg.measureSpec),
                            [],
                            { lazy: true },
                            meta.context
                        )
                        .then((groups) => {
                            const group = groups[0];
                            if (domain === "[]") {
                                count += group.__count;
                            }
                            for (const agg of aggregates) {
                                if (!data[agg.name]) {
                                    data[agg.name] = {
                                        values: new Array(meta.domains.length),
                                    };
                                }
                                const { type: fieldType } = meta.fields[agg.field];
                                data[agg.name].values[i] =
                                    group[agg.name] ||
                                    (["date", "datetime"].includes(fieldType) ? NaN : 0);
                            }
                        })
                );
            }
        }
        await Promise.all(proms);

        this._evalFormulae(meta, data);
        this._computeVariations(meta, data);

        this.data = data;
        this.count = count;
    }

    /**
     * @protected
     */
    _statisticsAsFields() {
        const fakeFields = {};
        for (const agg of this.metaData.aggregates) {
            fakeFields[agg.name] = agg;
        }
        for (const formula of this.metaData.formulae) {
            fakeFields[formula.name] = { ...formula, fieldType: "float" };
        }
        return fakeFields;
    }
}

// TODO:
// comparisons beware of legacy record
// check fakeFields in legacyrecord
