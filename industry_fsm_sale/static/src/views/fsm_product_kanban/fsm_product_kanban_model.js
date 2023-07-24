/** @odoo-module */

import { RelationalModel } from "@web/model/relational_model/relational_model";
import { FsmProductRecord } from "./fsm_product_record";

export class FsmProductKanbanModel extends RelationalModel {}

FsmProductKanbanModel.Record = FsmProductRecord;
