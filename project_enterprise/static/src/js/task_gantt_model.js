odoo.define('project_enterprise.TaskGanttModel', function (require) {
"use strict";

var GanttModel = require('web_gantt.GanttModel');
var _t = require('web.core')._t;

var TaskGanttModel = GanttModel.extend({
    /**
     * @private
     * @override
     * @returns {Object[]}
     */
    _generateRows: function (params) {
        if(params.groupedBy.length && _.first(params.groupedBy) === 'user_id'){
            var groupedByField = _.first(params.groupedBy);
            // check there isn't already an empty user_id group
            if(!_.some(params.groups, function(group){ return !group[groupedByField]; })){
                var new_group = {
                    id: _.uniqueId('group'),
                    fake: true,
                    __count: 0,
                    __domain: this._getDomain(),
                };

                _.each(params.groupedBy, function(field){
                    new_group[field] = false;
                });

                params.groups.push(new_group);
                this.ganttData.groups.push(new_group);
            }
        }
        var rows = this._super(params);
        // rename undefined asigned to
        _.each(rows, function(row){
            if(row.groupedByField === 'user_id' && !row.resId){
                row.name = _t('Unassigned tasks');
            }
        });

        // is the data grouped by?
        if(params.groupedBy && params.groupedBy.length){
            // in the last row is the grouped by field is null
            if(rows && rows.length && rows[rows.length - 1] && !rows[rows.length - 1].resId){
                // then make it the first one
                rows.unshift(rows.pop());
            }
        }
        return rows;
    },
});

return TaskGanttModel;
});