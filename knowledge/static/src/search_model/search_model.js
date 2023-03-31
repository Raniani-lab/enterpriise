/** @odoo-module **/

import { SearchModel } from "@web/search/search_model";

export class KnowledgeSearchModel extends SearchModel {
    setup(services, args) {
        this.onSaveKnowledgeFavorite = args.onSaveKnowledgeFavorite;
        this.onDeleteKnowledgeFavorite = args.onDeleteKnowledgeFavorite;
        super.setup(services, args);
    }

    /**
     * Save in embedded view arch instead of creating a record
     * @override
     */
    async _createIrFilters(irFilter) {
        this.onSaveKnowledgeFavorite(irFilter);
        return null;
    }

    /**
     * Delete from the embedded view arch instead of deleting the record
     * @override
     */
    async _deleteIrFilters(searchItem) {
        this.onDeleteKnowledgeFavorite(searchItem);
    }
}
