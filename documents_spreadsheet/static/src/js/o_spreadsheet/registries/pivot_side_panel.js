/** @odoo-module alias=documents_spreadsheet.PivotSidePanel */

import spreadsheet from "../o_spreadsheet_loader";
import { _t } from "web.core";
import { ComponentAdapter} from "web.OwlCompatibility";
import DomainSelector from "web.DomainSelector";
import pivotUtils from "documents_spreadsheet.pivot_utils";
import { time_to_str } from 'web.time';

const { sidePanelRegistry } = spreadsheet.registries;

/**
 * ComponentAdapter to allow using DomainSelector in a owl Component
 */
class DomainComponentAdapter extends ComponentAdapter {
    get widgetArgs() {
        return [this.props.model, this.props.domain, { readonly: true, filters: {} }];
    }
}

class PivotSidePanel extends owl.Component {
    constructor(parent, props) {
        super(...arguments);
        this.getters = this.env.getters;
        this.DomainSelector = DomainSelector;
    }

    /**
     * Format the given groupby
     * @param {Object} pivot record
     * @param {string} gp Groupby to format
     *
     * @returns groupby formatted
     */
    formatGroupBy(pivot, gp) {
        if (!this.getters.isCacheLoaded(pivot.id)) {
            return gp;
        }
        const cache = this.getters.getCache(pivot.id);
        return pivotUtils.formatGroupBy(cache, gp);
    }

    /**
     * Format the given measure
     * @param {Object} pivot record
     * @param {string} measure Measure to format
     *
     * @returns measure formatted
     */
    formatMeasure(pivot, measure) {
        if (pivot && this.getters.isCacheLoaded(pivot.id)) {
            const cache = this.getters.getCache(pivot.id);
            return measure.field === "__count" ? _t("Count") : cache.getField(measure.field).string;
        }
    }

    /**
     * Get the last update date, formatted
     * @param {Object} pivot record
     *
     * @returns {string} date formatted
     */
    getLastUpdate(pivot) {
        const lastUpdate = this.getters.getLastUpdate(pivot.id);
        if (lastUpdate) {
            return time_to_str(new Date(lastUpdate));
        }
        return _t("never");
    }

    /**
     * Refresh the cache of the given pivot
     *
     * @param {number} id Id of the pivot
     */
    refreshMeasures(id) {
        this.env.dispatch("REFRESH_PIVOT", { id });
    }

    getPivotName(pivot) {
        if (pivot && this.getters.isCacheLoaded(pivot.id)) {
            const cache = this.getters.getCache(pivot.id);
            const modelName = cache.getModelLabel();
            return `${modelName} (#${pivot.id})`;
        }
    }

    selectPivot(pivotId) {
        this.env.dispatch("SELECT_PIVOT", { pivotId })
    }

    resetSelectedPivot() {
        this.env.dispatch("SELECT_PIVOT");
        }
}
PivotSidePanel.template = "documents_spreadsheet.PivotSidePanel";
PivotSidePanel.components = { DomainComponentAdapter };

sidePanelRegistry.add("PIVOT_PROPERTIES_PANEL", {
    title: (env) => {
        return _t("Pivot properties");
    },
    Body: PivotSidePanel,
});
