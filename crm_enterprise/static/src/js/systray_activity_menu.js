odoo.define('crm_enterprise.systray.ActivityMenu', function (require) {
"use strict";

var ActivityMenu = require('@mail/js/systray/systray_activity_menu')[Symbol.for("default")];
require('crm.systray.ActivityMenu');

ActivityMenu.include({
    //--------------------------------------------------
    // Private
    //--------------------------------------------------
    /**
     * @override
     */
    _getViewsList(model) {
        if (model === "crm.lead") {
            return [[false, 'list'], [false, 'kanban'],
                    [false, 'form'],[false, 'calendar'],
                    [false, 'pivot'], [false, 'graph'],
                    [false, 'cohort'], [false, 'dashboard'],
                    [false, 'map'], [false, 'activity']
                ];
        }
        return this._super(...arguments);
    },
});
});
