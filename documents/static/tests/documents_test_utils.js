odoo.define('documents.test_utils', function (require) {
"use strict";

const AbstractStorageService = require('web.AbstractStorageService');
const RamStorage = require('web.RamStorage');
const { createView } = require('web.test_utils');

const { start } = require('@mail/../tests/helpers/test_utils');

function getEnrichedSearchArch(searchArch='<search></search>') {
    var searchPanelArch = `
        <searchpanel>
            <field name="folder_id" string="Workspace" enable_counters="1"/>
            <field name="tag_ids" select="multi" groupby="facet_id" enable_counters="1"/>
            <field name="res_model" select="multi" string="Attached To" enable_counters="1"/>
        </searchpanel>
    `;
    return searchArch.split('</search>')[0] + searchPanelArch + '</search>';
}

async function createDocumentsView(params) {
    params.archs = params.archs || {};
    params.archs[`${params.model},false,search`] =
         getEnrichedSearchArch(params.archs[`${params.model},false,search`]);
    if (!params.services || !params.services.local_storage) {
        // the searchPanel uses the localStorage to store/retrieve default
        // active category value
        params.services = params.services || {};
        const RamStorageService = AbstractStorageService.extend({
            storage: new RamStorage(),
        });
        params.services.local_storage = RamStorageService;
    }
    return createView(params);
}

async function createDocumentsViewWithMessaging(params) {
    const serverData = params.serverData || {};
    serverData.views = serverData.views || {};
    const searchArchs = {};
    for (const viewKey in serverData.views) {
        const [modelName] = viewKey.split(',');
        searchArchs[`${modelName},false,search`] = getEnrichedSearchArch(serverData.views[`${modelName},false,search`]);
    };
    Object.assign(serverData.views, searchArchs);
    params.legacyParams =  {
        ...params.legacyParams,
    };
    return start(params);
}

return {
    createDocumentsView,
    createDocumentsViewWithMessaging,
};

});
