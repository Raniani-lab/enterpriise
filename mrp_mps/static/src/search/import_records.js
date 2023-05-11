/** @odoo-module **/

import { ImportRecords } from "@base_import/import_records/import_records";
import { registry } from "@web/core/registry";

const cogMenuRegistry = registry.category("cogMenu");
const mpsImportRecordsItem = {
    Component: ImportRecords,
    groupNumber: 4,
    isDisplayed: ({ config }) =>
        config.mpsImportRecords
};
cogMenuRegistry.add("mps-import-records-menu", mpsImportRecordsItem, { sequence: 1 });
