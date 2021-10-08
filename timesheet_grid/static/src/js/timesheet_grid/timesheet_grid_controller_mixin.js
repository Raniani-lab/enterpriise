odoo.define('timesheet_grid.TimesheetGridControllerMixin', function (require) {
'use strict';

const TimesheetGridControllerMixin = {

    /**
     * @override
     */
    _getFormContext() {
        const formContext = this._super();
        const state = this.model.get();
        const cols = state.data && state.data.length > 0 ? state.data[0].cols : [];
        let firstWorkingDayCol = null;
        for (const col of cols) {
            if (col.is_current) {
                firstWorkingDayCol = null;
                break;
            } else if (!firstWorkingDayCol && !col.is_unavailable) {
                firstWorkingDayCol = col;
            }
        }
        const defaultColField = `default_${state.colField}`;
        if (firstWorkingDayCol && defaultColField in formContext) {
            // then we can assume the col field type is either a date or datetime since is_unavailable field is only available in thoses types.
            formContext[defaultColField] = firstWorkingDayCol.values[state.colField][0].split('/')[0];
        }
        return formContext;
    },
};

return TimesheetGridControllerMixin;

});
