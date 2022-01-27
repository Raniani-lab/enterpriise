/** @odoo-module alias=website_event_track_gantt.EventTrackGanttView **/

import view_registry from 'web.view_registry';
import GanttView from 'web_gantt.GanttView';
import EventTrackGanttController from 'website_event_track_gantt.EventTrackGanttController';

const EventTrackGanttView = GanttView.extend({
    config: Object.assign({}, GanttView.prototype.config, {
        Controller: EventTrackGanttController,
    }),
});

view_registry.add('event_track_gantt', EventTrackGanttView);

export default EventTrackGanttView;
