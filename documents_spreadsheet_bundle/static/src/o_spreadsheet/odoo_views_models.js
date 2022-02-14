/** @odoo-module */

import spreadsheet from "./o_spreadsheet_extended";
const { Registry } = spreadsheet;
const { EventBus } = owl;

/**
 * This class is used to abstract the spreadsheet models. It also provide to the
 * created models a unique ORM proxy (see below)
 */
export class OdooViewsModels extends EventBus {
    constructor(env, orm, metadataRepository) {
        super();
        this.env = env;
        this.orm = orm;
        this.metadataRepository = metadataRepository;
    }

    createModel(cls, params) {
        return new cls(params, this);
    }
}
