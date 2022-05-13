/** @odoo-module **/

import testUtils, { createCalendarView } from 'web.test_utils';
const initialDate = new Date("2021-06-22T08:00:00Z");
import PlanningCalendarView from '../src/js/calendar/planning_calendar_view.js';


QUnit.module("Planning.planning_calendar_tests", () => {

    QUnit.test("planning calendar view: copy previous week", async function (assert) {
        assert.expect(5);
        const data = {
            "planning.slot": {
                fields: {
                    id: { string: "ID", type: "integer" },
                    name: { string: "Note", type: "text" },
                    color: { string: "Color", type: "integer" },
                    display_name: { string: 'Name', type: 'char' },
                    start: { string: "Start Date", type: "datetime" },
                    stop: { string: "Stop Date", type: "datetime" },
                    resource_id: { string: "Assigned to", type: "many2one", relation: "resource.resource" },
                    role_id: { string: "Role", type: "many2one", relation: "role" },
                    state: {
                        string: "State",
                        type: "selection",
                        selection: [['draft', 'Draft'], ['published', 'Published']],
                    },
                },
                records: [{
                    'id': 1,
                    'name': "First Record",
                    'start': moment(initialDate).format('YYYY-MM-DD HH:00:00'),
                    'stop': moment(initialDate).add(4, 'hours').format('YYYY-MM-DD HH:00:00'),
                    'resource_id': 1,
                    'color': 7,
                    'role_id': 1,
                    'state': 'draft'
                }, {
                    'id': 2,
                    'name': "Second Record",
                    'start': moment(initialDate).add(2, 'days').format('YYYY-MM-DD HH:00:00'),
                    'stop': moment(initialDate).add(2, 'days').add(4, 'hours').format('YYYY-MM-DD HH:00:00'),
                    'resource_id': 2,
                    'color': 9,
                    'role_id': 2,
                    'state': 'published'
                }],
                check_access_rights: () => Promise.resolve(true),
            },
            'resource.resource': {
                fields: {
                    id: { string: "ID", type: "integer" },
                    name: { string: "Name", type: "char" },
                },
                records: [
                    { 'id': 1, 'name': 'Chaganlal' },
                    { 'id': 2, 'name': 'Maganlal' }
                ],
            },
            role: {
                fields: {
                    id: { string: "ID", type: "integer" },
                    name: { string: "Name", type: "char" },
                    color: { string: "Color", type: "integer" },
                },
                records: [
                    { 'id': 1, 'name': 'JavaScript Developer', color: 1 },
                    { 'id': 2, 'name': 'Functional Consultant', color: 2 },
                ],
            },
        };

        const calendar = await createCalendarView({
            View: PlanningCalendarView,
            model: "planning.slot",
            data: data,
            arch:
                `<calendar class="o_planning_calendar_test"
                    event_open_popup="true"
                    date_start="start"
                    date_stop="stop"
                    color="color"
                    mode="week"
                    js_class="planning_calendar">
                        <field name="resource_id" />
                        <field name="role_id" filters="1" color="color"/>
                        <field name="state"/>
                </calendar>`,
            viewOptions: {
                initialDate: initialDate,
            },
            mockRPC: function (route, args) {
                if (args.method === 'action_copy_previous_week') {
                    assert.step("copy_previous_week()");
                }
                return this._super(...arguments);
            },
            intercepts: {
                do_action: function (event) {
                    assert.deepEqual(event.data.action, "planning.planning_send_action", 'should open "Send Planning By Email" form view');
                },
            },
        });

        assert.hasClass(calendar.el.querySelector('.o_calendar_container'), "o_planning_calendar_test", "should have a planning calendar class");

        await testUtils.dom.click(calendar.el.querySelector(".o_button_copy_previous_week"))
        assert.verifySteps(['copy_previous_week()'], 'verify action_copy_previous_week() invoked.');

        // deselect "Maganlal" from Assigned to
        await testUtils.dom.click(calendar.el.querySelector(".o_calendar_filter_item[data-value='2'] > input"));
        assert.containsN(calendar, '.fc-event', 1, "should display 1 events on the week");

        await testUtils.dom.click(calendar.el.querySelector(".o_button_send_all"));

        calendar.destroy();
    });

});
