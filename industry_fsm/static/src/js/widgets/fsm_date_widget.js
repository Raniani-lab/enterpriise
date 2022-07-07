/** @odoo-module **/

import AbstractField from 'web.AbstractField';
import fieldRegistry from 'web.field_registry';
import time from 'web.time';

const FsmDateWidget = AbstractField.extend({
    /**
     * @override
     */
    _render() {
        const valueMoment = moment(this.value.toISOString());
        let className= "";
        const wholeDate = !('fsm_task_kanban_whole_date' in this.record.context) || this.record.context.fsm_task_kanban_whole_date;
        const precision = wholeDate ? "day" : "second";
        const dateFormat = wholeDate ? time.getLangDateFormat() : time.getLangTimeFormat().search('H') !== -1 ? 'HH:mm' : 'hh:mm A';
        if (this.recordData.fsm_done) {
            className = "fw-bold";
        } else {
            if ((!wholeDate || this.recordData.is_fsm) && valueMoment.isBefore(moment(), precision)) {
                className = "oe_kanban_text_red";
            }
            if (wholeDate && this.recordData.is_fsm && valueMoment.isSame(moment(), precision)) {
                className = "text-warning fw-bold";
            }
        }
        this.$el.text(valueMoment.format(dateFormat));
        this.$el.addClass(className);
    }
});

fieldRegistry.add('fsm_date', FsmDateWidget);
