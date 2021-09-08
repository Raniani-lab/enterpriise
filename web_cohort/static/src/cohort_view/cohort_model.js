/* @odoo-module */

import { _lt } from "@web/core/l10n/translation";
import { KeepLast } from "@web/core/utils/concurrency";
import { Model } from "@web/views/helpers/model";
import { buildSampleORM } from "@web/views/helpers/sample_server";
import { computeReportMeasures, processMeasure } from "@web/views/helpers/utils";

export const MODES = ["retention", "churn"];
export const TIMELINES = ["forward", "backward"];
export const INTERVALS = {
    day: _lt("Day"),
    week: _lt("Week"),
    month: _lt("Month"),
    year: _lt("Year"),
};

/**
 * @typedef {import("@web/search/search_model").SearchParams} SearchParams
 */

export class CohortModel extends Model {
    /**
     * @override
     */
    setup(params, { orm, user }) {
        this.orm = orm;
        this.user = user;

        this.keepLast = new KeepLast();

        this.metaData = params;
        this.data = null;
        this.searchParams = null;
    }

    /**
     * @param {SearchParams} searchParams
     */
    load(searchParams) {
        const { comparison, context, domain } = searchParams;
        this.searchParams = { context };
        if (comparison) {
            this.searchParams.domains = comparison.domains;
        } else {
            this.searchParams.domains = [{ arrayRepr: domain, description: null }];
        }
        const { cohort_interval, cohort_measure } = searchParams.context;
        this.metaData.interval = cohort_interval || this.metaData.interval;

        this.metaData.measure = processMeasure(cohort_measure) || this.metaData.measure;
        this.metaData.measures = computeReportMeasures(
            this.metaData.fields,
            this.metaData.fieldAttrs,
            [this.metaData.measure],
            this.metaData.additionalMeasures
        );
        return this._load(this.metaData);
    }

    /**
     * @param {Object} metaData
     */
    async _load(metaData) {
        this.data = await this._fetchData(metaData, this.orm);

        // To check:
        if (metaData.useSampleModel && this.data.some((data) => data.rows.length === 0)) {
            const fakeORM = buildSampleORM(metaData.resModel, metaData.fields, this.user);
            this.data = await this._fetchData(metaData, fakeORM);
        } else {
            this.metaData.useSampleModel = false;
        }

        for (const i in this.data) {
            this.data[i].title = this.searchParams.domains[i].description;
        }

        this.hasData = this.data.some((data) => data.rows.length > 0);
    }

    async _fetchData(metaData, orm) {
        return this.keepLast.add(
            Promise.all(
                this.searchParams.domains.map(({ arrayRepr: domain }) => {
                    return orm.call(metaData.resModel, "get_cohort_data", [], {
                        date_start: metaData.dateStart,
                        date_stop: metaData.dateStop,
                        measure: metaData.measure,
                        interval: metaData.interval,
                        domain: domain,
                        mode: metaData.mode,
                        timeline: metaData.timeline,
                        context: this.searchParams.context,
                    });
                })
            )
        );
    }

    /**
     * @param {Object} params
     */
    async updateMetaData(params) {
        Object.assign(this.metaData, params);
        await this._load(this.metaData);
        this.notify();
    }
}

CohortModel.services = ["orm", "user"];
