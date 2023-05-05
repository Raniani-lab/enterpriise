/** @odoo-module **/

import { MapModel } from "@web_map/map_view/map_model";

export class ProjectTaskMapModel extends MapModel {
    /**
     * @override
     */
    _getEmptyGroupLabel(fieldName) {
        if (fieldName === "project_id") {
            return this.env._t("Private");
        } else if (fieldName === "user_ids") {
            return this.env._t("Unassigned");
        } else {
            return super._getEmptyGroupLabel(fieldName);
        }
    }
}
