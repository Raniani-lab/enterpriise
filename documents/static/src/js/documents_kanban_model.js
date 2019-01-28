odoo.define('documents.DocumentsKanbanModel', function (require) {
"use strict";

/**
 * This file defines the Model for the Documents Kanban view, which is an
 * override of the KanbanModel.
 */

var KanbanModel = require('web.KanbanModel');
var core = require('web.core');
var utils = require('web.utils');

var _t = core._t;

var DocumentsKanbanModel = KanbanModel.extend({
    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @param {Integer} recordID
     * @returns {Deferred}
     */
    fetchActivities: function (recordID) {
        var record = this.localData[recordID];
        return this._fetchSpecialActivity(record, 'activity_ids').then(function (data) {
            record.specialData.activity_ids = data;
        });
    },
    /**
     * @override
     */
    get: function (dataPointID) {
        var result = this._super.apply(this, arguments);
        if (result && result.type === 'list') {
            var dataPoint = this.localData[dataPointID];
            _.extend(result, _.pick(dataPoint,
                                   'availableFolderIDs',
                                   'folderID',
                                   'folders',
                                   'relatedModels',
                                   'size',
                                   'tags')
            );
        }
        return result;
    },
    /**
     * Override to explicitly specify the 'searchDomain', which is the domain
     * coming from the search view. This domain is used to load the related
     * models, whereas a combination of this domain and the domain of the
     * DocumentsSelector is used for the classical search_read.
     *
     * Also fetch the folders here, so that it is done only once, as it doesn't
     * depend on the domain. Moreover, the folders are necessary to fetch the
     * tags, as we first fetch tags of the default folder.
     *
     * @override
     */
    load: function (params) {
        var self = this;
        var _super = this._super.bind(this);
        return this._fetchFolders().then(function (folders) {
            var availableFolderIDs = _.pluck(folders, 'id');
            var folderTree = self._buildFolderTree(folders, false);
            var folderID = params.context.saved_folder ? Number(utils.get_cookie('documents_last_folder_id')) : false;
            params = _.extend({}, params, {
                availableFolderIDs: availableFolderIDs,
                folderID: folderID,
                folders: folderTree,
            });

            params.domain = params.domain || [];
            params.searchDomain = params.domain;
            params.domain = self._extendDomainWithFolder(params.domain, folderID, availableFolderIDs);

            var def = _super(params);
            return self._fetchAdditionalData(def, params).then(function (dataPointID) {
                var dataPoint = self.localData[dataPointID];
                dataPoint.availableFolderIDs = params.availableFolderIDs;
                dataPoint.folderID = params.folderID;
                dataPoint.folders = params.folders;
                dataPoint.isRootDataPoint = true;
                dataPoint.searchDomain = params.searchDomain;
                return dataPointID;
            });
        });
    },
    /**
     * Override to handle the 'selectorDomain' coming from the
     * DocumentsInspector, and to explicitely specify the 'searchDomain', which
     * is the domain coming from the search view. This domain is used to load
     * the related models, whereas a combination of the 'searchDomain' and the
     * 'selectorDomain' is used for the classical search_read.
     *
     * @override
     * @param {Array[]} [options.selectorDomain] the domain coming from the
     *   DocumentsInspector
     */
    reload: function (id, options) {
        options = options || {};
        var element = this.localData[id];

        if (element.isRootDataPoint) {
            // we are reloading the whole view
            element.folderID = options.folderID;
            element.availableFolderIDs = options.availableFolderIDs;

            var searchDomain = options.domain || element.searchDomain;
            element.searchDomain = options.searchDomain = searchDomain;
            options.domain = this._extendDomainWithFolder(searchDomain, options.folderID, options.availableFolderIDs);
            if (options.selectorDomain !== undefined) {
                options.domain = searchDomain.concat(options.selectorDomain);
            }
        }

        var def = this._super.apply(this, arguments);
        if (element.isRootDataPoint) {
            return this._fetchAdditionalData(def, options);
        } else {
            return def;
        }
    },
    /**
     * Save changes on several records in a mutex, and reload.
     *
     * @param {string[]} recordIDs
     * @param {Object} values
     * @param {string} parentID
     * @returns {Deferred<string>} resolves with the parentID
     */
    saveMulti: function (recordIDs, values, parentID) {
        return this.mutex.exec(this._saveMulti.bind(this, recordIDs, values, parentID));
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Return an extended version of the given domain containing a part that
     * filters out records that do not belong to the given folder.
     *
     * @private
     * @param {Array[]} domain
     * @param {integer} folderID
     * @param {integer[]} availableFolderIDs
     * @returns {Array[]}
     */
    _extendDomainWithFolder: function (domain, folderID, availableFolderIDs) {
        if (folderID) {
            return domain.concat([['folder_id', '=', folderID]]);
        } else {
            return domain.concat([['folder_id', 'in', availableFolderIDs || []]]);
        }
    },
    /**
     * Build folders' tree based on flat array returned from server
     *
     * @private
     * @param {Array<Object>} folders
     * @param {Integer} parent_id
     * @returns {Array<Object>}
     */
    _buildFolderTree: function (folders, parent_id) {
        var self = this;
        if (folders.length === 0) {
            return [];
        }
        var rootFolders = _.filter(folders, function (folder) {
            return folder.parent_folder_id === parent_id ||
                   (_.isArray(folder.parent_folder_id) && folder.parent_folder_id[0] === parent_id);
        });
        var subFolders = _.filter(folders, function (folder) {
            return folder.parent_folder_id !== parent_id ||
                   (_.isArray(folder.parent_folder_id) && folder.parent_folder_id[0] !== parent_id);
        });
        return _.map(rootFolders, function (folder) {
            return {
                id: folder.id,
                name: folder.name,
                description: folder.description,
                children: self._buildFolderTree(subFolders, folder.id)
            };
        });
    },
    /**
     * Fetch additional data required by the DocumentsKanban view.
     *
     * @param {Deferred<string>} def resolves with the id of the dataPoint
     *   created by the load/reload call
     * @param {Object} params parameters/options passed to the load/reload function
     * @returns {Deferred<string>} resolves with the dataPointID
     */
    _fetchAdditionalData: function (def, params) {
        var self = this;
        var defs = [def];
        defs.push(this._fetchRelatedModels(params));
        defs.push(this._fetchSize(params));
        defs.push(this._fetchTags(params));
        return $.when.apply($, defs).then(function (dataPointID, models, size, tags) {
            var dataPoint = self.localData[dataPointID];
            dataPoint.relatedModels = models;
            dataPoint.tags = tags;
            dataPoint.size = size;
            return dataPointID;
        });
    },
    /**
     * Fetch all folders
     *
     * @private
     * @returns {Deferred<array>}
     */
    _fetchFolders: function () {
        return this._rpc({
            model: 'documents.folder',
            method: 'search_read',
            fields: ['parent_folder_id', 'name', 'id', 'description'],
        });
    },
    /**
     * Fetch all related models.
     *
     * @private
     * @param {Object} params parameters/options passed to the load/reload function
     * @param {array} params.domain domain used during the load/reload call
     * @returns {Deferred<array>}
     */
    _fetchRelatedModels: function (params) {
        params = params || {};
        return this._rpc({
            model: 'documents.document',
            method: 'get_model_names',
            args: [[], this._extendDomainWithFolder(params.searchDomain, params.folderID, params.availableFolderIDs)],
        }).then(function (models) {
            return _.map(models, function (model) {
                if (!model.res_model_name) {
                    model.res_model_name = model.res_model || _t('Not a file');
                }
                if (model.res_model === 'documents.document') {
                    model.res_model_name = _t('Not attached');
                }
                return model;
            });
        });
    },
    /**
     * Fetch the sum of the size of the documents matching the current domain.
     *
     * @private
     * @param {Object} params
     * @returns {Deferred<integer>} the size, in MB
     */
    _fetchSize: function (params) {
        params = params || {};
        return this._rpc({
            model: 'documents.document',
            method: 'read_group',
            domain: params.domain || [],
            fields: ['file_size'],
            groupBy: [],
        }).then(function (result) {
            var size = result[0].file_size / (1000*1000); // in MB
            return Math.round(size * 100) / 100;
        });
    },
    /**
     * Fetch all tags. A tag as a 'tag_id', a 'tag_name', a 'facet_id', a
     * 'facet_name', a 'facet_tooltip' and a 'count' (the number of records linked to this tag).
     *
     * @private
     * @param {Object} params parameters/options passed to the load/reload function
     * @param {Array} params.domain domain used during the load/reload call
     * @param {integer} params.folderID the current folder ID
     * @param {integer[]} params.availableFolderIDs all the folder IDs available
     * @returns {Deferred<Array>}
     */
    _fetchTags: function (params) {
        params = params || {};
        if (!params.folderID) {
            return $.when([]);
        }
        return this._rpc({
            model: 'documents.tag',
            method: 'group_by_documents',
            kwargs: {
                folder_id: params.folderID,
                domain: this._extendDomainWithFolder(params.domain, params.folderID, params.availableFolderIDs),
            },
        });
    },
    /**
     * Save changes on several records. Be careful that this function doesn't
     * handle all field types: only primitive types, many2ones and many2manys
     * (forget and link_to commands) are covered.
     *
     * @private
     * @param {string[]} recordIDs
     * @param {Object} values
     * @param {string} parentID
     * @returns {Deferred<string>} resolves with the parentID
     */
    _saveMulti: function (recordIDs, values, parentID) {
        var self = this;
        var parent = this.localData[parentID];
        var resIDs = _.map(recordIDs, function (recordID) {
            return self.localData[recordID].res_id;
        });
        var changes = _.mapObject(values, function (value, fieldName) {
            var field = parent.fields[fieldName];
            if (field.type === 'many2one') {
                value = value.id;
            } else if (field.type === 'many2many') {
                var command = value.operation === 'FORGET' ? 3 : 4;
                value = _.map(value.resIDs, function (resID) {
                    return [command, resID];
                });
            }
            return value;
        });

        return this._rpc({
            model: parent.model,
            method: 'write',
            args: [resIDs, changes],
        });
    },
});

return DocumentsKanbanModel;

});
