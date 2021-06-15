/** @odoo-module alias=documents_spreadsheet.PivotDetailsSidePanel */

import { _t } from "web.core";
import { ComponentAdapter} from "web.OwlCompatibility";
import DomainSelector from "web.DomainSelector";
import pivotUtils from "documents_spreadsheet.pivot_utils";
import { time_to_str } from 'web.time';

/**
 * ComponentAdapter to allow using DomainSelector in a owl Component
 */
class DomainComponentAdapter extends ComponentAdapter {
    get widgetArgs() {
        return [this.props.model, this.props.domain, { readonly: true, filters: {} }];
    }
}

export class PivotDetailsSidePanel extends owl.Component {
    constructor(parent, props) {
        super(...arguments);
        this.getters = this.env.getters;
        this.DomainSelector = DomainSelector;
    }

    get pivot() {
        return this.getters.getPivot(this.props.pivotId);
    }

    /**
     * Format the given groupby
     * @param {string} gp Groupby to format
     *
     * @returns groupby formatted
     */
    formatGroupBy(gp) {
        if (!this.getters.isCacheLoaded(this.pivot.id)) {
            return gp;
        }
        const cache = this.getters.getCache(this.pivot.id);
        return pivotUtils.formatGroupBy(cache, gp);
    }

    /**
     * Format the given measure
     * @param {string} measure Measure to format
     *
     * @returns measure formatted
     */
    formatMeasure(measure) {
        if (this.getters.isCacheLoaded(this.pivot.id)) {
            const cache = this.getters.getCache(this.pivot.id);
            return measure.field === "__count" ? _t("Count") : cache.getField(measure.field).string;
        }
    }

    /**
     * Get the last update date, formatted
     *
     * @returns {string} date formatted
     */
    getLastUpdate() {
        const lastUpdate = this.getters.getLastUpdate(this.pivot.id);
        if (lastUpdate) {
            return time_to_str(new Date(lastUpdate));
        }
        return _t("never");
    }

    /**
     * Refresh the cache of the given pivot
     *
     */
    refreshMeasures() {
        this.env.dispatch("REFRESH_PIVOT", { id: this.props.pivotId });
    }

    getPivotName() {
        return this.getters.getPivotName(this.props.pivotId);
    }

}
PivotDetailsSidePanel.template = "documents_spreadsheet.PivotDetailsSidePanel";
PivotDetailsSidePanel.components = { DomainComponentAdapter };
PivotDetailsSidePanel.props = {
    pivotId: Number
};
