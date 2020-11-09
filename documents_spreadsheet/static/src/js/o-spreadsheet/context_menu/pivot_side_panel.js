odoo.define("documents_spreadsheet.pivot_side_panel", function (require) {
    "use strict";

    const core = require("web.core");
    const { ComponentAdapter } = require("web.OwlCompatibility");
    const DomainSelector = require("web.DomainSelector");
    const spreadsheet = require("documents_spreadsheet.spreadsheet_extended");
    const pivotUtils = require("documents_spreadsheet.pivot_utils");
    const { sprintf } = require("web.utils");
    const { time_to_str } = require('web.time');

    const _t = core._t;
    const sidePanelRegistry = spreadsheet.registries.sidePanelRegistry;
    const { useState } = owl.hooks;

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
            return pivotUtils.formatGroupBy(pivot, gp);
        }

        /**
         * Format the given measure
         * @param {Object} pivot record
         * @param {string} measure Measure to format
         *
         * @returns measure formatted
         */
        formatMeasure(pivot, measure) {
            if (pivot && pivot.cache) {
                return measure.field === "__count" ? _t("Count") : pivot.cache.getField(measure.field).string;
            }
        }

        /**
         * Get the last update date, formatted
         * @param {Object} pivot record
         *
         * @returns {string} date formatted
         */
        getLastUpdate(pivot) {
            return time_to_str(new Date(pivot.lastUpdate));
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
            if (pivot && pivot.cache) {
                const modelName = pivot.cache.getModelLabel();
                return sprintf(_t("%s (#%s)"), modelName, pivot && pivot.id);
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
});
