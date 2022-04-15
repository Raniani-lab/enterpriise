/** @odoo-module **/

import {_t} from 'web.core'

import GanttController from 'web_gantt.GanttController';

export default GanttController.extend({
    events: _.extend({}, GanttController.prototype.events),

    _fetchRecords: function () {
        return this.model.ganttData.records;
    },
    _fetchFirstDay: function () {
        return this.model.ganttData.startDate;
    },
    _fetchLastDay: function () {
        return this.model.ganttData.stopDate;
    },
    _displayWarning: function ($warning) {
        this.$('.o_gantt_view').before($warning);
    },

    async _onPillClicked(ev) {
        const t = this;
        this._rpc({
            model: 'homeworking.entry',
            method: 'get_entry_info',
            args: [[ev.data.target.data('id')]],
        }).then(function (data) {
            t.do_action({
                name: _t("Change work location"),
                type: 'ir.actions.act_window',
                view_mode: 'form',
                views: [[false, 'form']],
                target: 'new',
                res_model: 'change.homeworking.location.wizard',
            }, {
                additional_context: {
                    'default_employee_id': data.employee_id,
                    'default_date': data.date,
                    'default_homeworking_location_id': data.homeworking_location_id,
                },
                on_close: () => {
                    t.update({}, {reload: true});
                },
            });
        })
    },
});
