/** @odoo-module alias=website_event_track_gantt.EventTrackGanttController **/

import {_t} from 'web.core';
import Dialog from 'web.Dialog';
import GanttController from 'web_gantt.GanttController';

const EventTrackGanttController = GanttController.extend({
    _openDialog: function (resID, context) {
        const dialog = this._super(...arguments);

        dialog.on('closed', this, () => {
            // we reload as record can be deleted or unscheduled
            this.reload();
        });

        dialog.on('execute_action', this, event => {
            const actionName = event.data.action_data.name || event.data.action_data.special;

            if (actionName === "unlink") {
                event.stopPropagation();

                Dialog.confirm(this, _t('Are you sure you want to delete this track?'), {
                    confirm_callback: () => {
                        this.trigger_up('execute_action', event.data);
                        setTimeout(() => dialog.destroy(), 200);
                    },
                    cancel_callback: evt => {
                        dialog.$footer.find('button').removeAttr('disabled');
                    }
                });
            }
        });

        return dialog;
    },
});

export default EventTrackGanttController;
