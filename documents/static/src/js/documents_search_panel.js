odoo.define('documents.DocumentsSearchPanel', function (require) {
"use strict";

/**
 * This file defines the DocumentsSearchPanel widget, an extension of the
 * SearchPanel to be used in the documents kanban view.
 */

var SearchPanel = require('web.SearchPanel');

var DocumentsSearchPanel = SearchPanel.extend({
    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Returns a description of each folder (record of documents.folder).
     *
     * @returns {Object[]}
     */
    getFolders: function () {
        var category = _.findWhere(this.categories, {fieldName: 'folder_id'});
        return Object.keys(category.values).map(function (folderId) {
            return category.values[folderId];
        });
    },
    /**
     * Returns the id of the current selected folder, if any, false otherwise.
     *
     * @returns {integer|false}
     */
    getSelectedFolderId: function () {
        var category = _.findWhere(this.categories, {fieldName: 'folder_id'});
        return category.activeValueId;
    },
    /**
     * Returns ids of selected tags.
     *
     * @returns {integer[]}
     */
    getSelectedTagIds: function () {
        var filter = _.findWhere(this.filters, {fieldName: 'tag_ids'});
        return Object.keys(filter.values).filter(function (tagId) {
            return filter.values[tagId].checked;
        });
    },
    /**
     * Returns a description of each tag (record of documents.tag).
     *
     * @returns {Object[]}
     */
    getTags: function () {
        var filter = _.findWhere(this.filters, {fieldName: 'tag_ids'});
        return Object.keys(filter.values).map(function (tagId) {
            return filter.values[tagId];
        });
    },
});

return DocumentsSearchPanel;

});
