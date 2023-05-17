/* @odoo-module */

import { SearchModel } from "@web/search/search_model";

export class PlanningSearchModel extends SearchModel {
    exportState() {
        return {
            ...super.exportState(),
            highlightPlannedIds: this.highlightPlannedIds,
        };
    }

    _importState(state) {
        this.highlightPlannedIds = state.highlightPlannedIds;
        super._importState(state);
    }

    deactivateGroup(groupId) {
        if (this._getHighlightPlannedSearchItems().groupId === groupId) {
            this.highlightPlannedIds = null;
        }
        super.deactivateGroup(groupId);
    }

    toggleHighlightPlannedFilter(highlightPlannedIds) {
        if (highlightPlannedIds) {
            this.highlightPlannedIds = highlightPlannedIds;
            this.toggleSearchItem(this._getHighlightPlannedSearchItems().id);
        } else {
            this.deactivateGroup(this._getHighlightPlannedSearchItems().groupId);
        }
    }

    _getHighlightPlannedSearchItems() {
        return Object.values(this.searchItems).find(
            (v) => v.name === "shift_planned"
        );
    }
}
