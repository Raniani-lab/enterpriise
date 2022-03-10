/** @odoo-module */

import { qweb as QWeb } from 'web.core';

import CalendarPopover from 'web.CalendarPopover';
import fieldUtils from 'web.field_utils';

    const PlanningCalendarPopover = CalendarPopover.extend({
        template: 'Planning.event.popover',

        init () {
            this._super(...arguments);
            this.allocated_hours = fieldUtils.format.float_time(this.event.extendedProps.record.allocated_hours);
            this.allocated_percentage = fieldUtils.format.float(this.event.extendedProps.record.allocated_percentage);
            this.resource_type = this.event.extendedProps.record.resource_type;
        },

        willStart() {
            const self = this;
            const check_group = this.getSession().user_has_group('planning.group_planning_manager').then(function(has_group) {
                self.is_manager = has_group;
            });
            return Promise.all([this._super(...arguments), check_group]);
        },

        renderElement() {
            let render = $(QWeb.render(this.template, { widget: this }));
            if(!this.is_manager) {
                render.find('.card-footer').remove();
            }

            this._replaceElement(render);
        },

        /**
         * Hide empty fields from the calendar popover
         * @override
         */
        _processFields() {
            var self = this;

            if (!CalendarPopover.prototype.origDisplayFields) {
                CalendarPopover.prototype.origDisplayFields = _.extend({}, this.displayFields);
            } else {
                this.displayFields = _.extend({}, CalendarPopover.prototype.origDisplayFields);
            }

            _.each(this.displayFields, function(def, field) {
                if (self.event.extendedProps && self.event.extendedProps.record && !self.event.extendedProps.record[field]) {
                    delete self.displayFields[field];
                } 
            });

            return this._super(...arguments);
        }
    });

    export default PlanningCalendarPopover;
