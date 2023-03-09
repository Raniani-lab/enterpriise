/** @odoo-module **/
import { Component } from "@odoo/owl";

export class BankRecFinishButtons extends Component {
    static template = "account_accountant.BankRecFinishButtons";
    static props = {};

    getJournalFilter() {
        // retrieves the searchModel's searchItem for the journal
        return Object.values(this.env.searchModel.searchItems).filter(i => i.type == "field" && i.fieldName == "journal_id")[0];
    }

    get breadcrumbs() {
        return this.env.config.breadcrumbs;
    }

    get otherFiltersActive() {
        const facets = this.env.searchModel.facets;
        const journalFilterItem = this.getJournalFilter();
        for (const facet of facets) {
            if (facet.groupId !== journalFilterItem.groupId) {
                return true;
            }
        }
        return false;
    }

    clearFilters() {
        const facets = this.env.searchModel.facets;
        const journalFilterItem = this.getJournalFilter();
        for (const facet of facets) {
            if (facet.groupId !== journalFilterItem.groupId) {
                this.env.searchModel.deactivateGroup(facet.groupId);
            }
        }
    }

    breadcrumbBackOrDashboard() {
        if (this.breadcrumbs.length > 1) {
            this.env.services.action.restore();
        } else {
            this.env.services.action.doAction("account.open_account_journal_dashboard_kanban", {clearBreadcrumbs: true});
        }
    }
}
