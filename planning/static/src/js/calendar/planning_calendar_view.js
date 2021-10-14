/** @odoo-module */

import CalendarView from 'web.CalendarView';
import view_registry from 'web.view_registry';

import PlanningCalendarModel from './planning_calendar_model.js'
import PlanningCalendarController from './planning_calendar_controller.js';
import PlanningCalendarRenderer from './planning_calendar_renderer.js';


const PlanningCalendarView = CalendarView.extend({
    config: Object.assign({}, CalendarView.prototype.config, {
        Model: PlanningCalendarModel,
        Renderer: PlanningCalendarRenderer,
        Controller: PlanningCalendarController,
    }),
});

view_registry.add('planning_calendar', PlanningCalendarView);

export default PlanningCalendarView;
