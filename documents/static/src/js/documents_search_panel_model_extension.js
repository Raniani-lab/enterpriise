odoo.define("documents/static/src/js/documents_search_panel_model_extension", function (require) {
    "use strict";

    const ActionModel = require("web/static/src/js/views/action_model.js");
    const SearchPanelModelExtension = require("web/static/src/js/views/search_panel_model_extension.js");

    // Helpers
    const isFolderCategory = (s) => s.type === "category" && s.fieldName === "folder_id";
    const isTagFilter = (s) => s.type === "filter" && s.fieldName === "tag_ids";

    class DocumentsSearchPanelModelExtension extends SearchPanelModelExtension {
        constructor() {
            super(...arguments);

            this.DEFAULT_VALUE_INDEX = 1;
        }

        //---------------------------------------------------------------------
        // Public
        //---------------------------------------------------------------------

        /**
         * @override
         * @returns {any}
         */
        get(property) {
            switch (property) {
                case "folders": return this.getFolders();
                case "selectedFolderId": return this.getSelectedFolderId();
                case "selectedTagIds": return this.getSelectedTagIds();
                case "tags": return this.getTags();
            }
            return super.get(...arguments);
        }

        //---------------------------------------------------------------------
        // Actions / Getters
        //---------------------------------------------------------------------

        /**
         * Returns a description of each folder (record of documents.folder).
         * @returns {Object[]}
         */
        getFolders() {
            const { values } = this.getSections(isFolderCategory)[0];
            return [...values.values()];
        }

        /**
         * Returns the id of the current selected folder, if any, false
         * otherwise.
         * @returns {number | false}
         */
        getSelectedFolderId() {
            const { activeValueId } = this.getSections(isFolderCategory)[0];
            return activeValueId;
        }

        /**
         * Returns ids of selected tags.
         * @returns {number[]}
         */
        getSelectedTagIds() {
            const { values } = this.getSections(isTagFilter)[0];
            return [...values.values()].filter((value) => value.checked);
        }

        /**
         * Returns a description of each tag (record of documents.tag).
         * @returns {Object[]}
         */
        getTags() {
            const { values } = this.getSections(isTagFilter)[0];
            return [...values.values()].sort((a, b) => {
                if (a.group_sequence === b.group_sequence) {
                    return a.sequence - b.sequence;
                } else {
                    return a.group_sequence - b.group_sequence;
                }
            });
        }

        /**
         * Updates the folder id of a record matching the given value.
         * @param {number[]} recordIds
         * @param {number} valueId
         */
        async updateRecordFolderId(recordIds, valueId) {
            await this.env.services.rpc({
                model: "documents.document",
                method: "write",
                args: [recordIds, { folder_id: valueId }],
            });
        }

        /**
         * Updates the tag ids of a record matching the given value.
         * @param {number[]} recordIds
         * @param {number} valueId
         */
        async updateRecordTagId(recordIds, valueId) {
            await this.env.services.rpc({
                model: "documents.document",
                method: "write",
                args: [recordIds, { tag_ids: [[4, valueId]] }],
            });
        }
    }

    ActionModel.registry.add("DocumentsSearchPanel", DocumentsSearchPanelModelExtension, 30);

    return DocumentsSearchPanelModelExtension;
});
