/** @odoo-module **/

import AttendeeCalendarView from 'calendar.CalendarView';
import { browser } from "@web/core/browser/browser";
import { patchWithCleanup } from "@web/../tests/helpers/utils";
import session from 'web.session';
import testUtils from 'web.test_utils';

const createCalendarView = testUtils.createCalendarView;
const initialDate = new Date(moment().add(1, 'years').format('YYYY-01-05 00:00:00'));


QUnit.module('appointment_hr.appointment_link', {
    beforeEach: function () {
        patchWithCleanup(session, {
            uid: 1,
        });
        this.data = {
            'res.users': {
                fields: {
                    id: {string: 'ID', type: 'integer'},
                    name: {string: 'Name', type: 'char'},
                    partner_id: {string: 'Partner', type: 'many2one', relation: 'res.partner'},
                    employee_id: {string: 'Employee', type: 'many2one', relation: 'hr.employee'},
                },
                records: [
                    {id: session.uid, name: 'User 1', partner_id: 1, employee_id: 1},
                    {id: 214, name: 'User 214', partner_id: 214, employee_id: 214},
                    {id: 216, name: 'User 216', partner_id: 216, employee_id: 216},
                ],
            },
            'res.partner': {
                fields: {
                    id: {string: 'ID', type: 'integer'},
                    display_name: {string: "Displayed name", type: "char"},
                },
                records: [
                    {id: 1, display_name: 'Partner 1'},
                    {id: 214, display_name: 'Partner 214'},
                    {id: 216, display_name: 'Partner 216'},
                ],
            },
            'calendar.event': {
                fields: {
                    id: {string: 'ID', type: 'integer'},
                    user_id: {string: 'User', type: 'many2one', relation: 'res.users'},
                    partner_id: {string: 'Partner', type: 'many2one', relation: 'res.partner', related: 'user_id.partner_id'},
                    name: {string: 'Name', type: 'char'},
                    start_date: {string: 'Start date', type: 'date'},
                    stop_date: {string: 'Stop date', type: 'date'},
                    start: {string: 'Start datetime', type: 'datetime'},
                    stop: {string: 'Stop datetime', type: 'datetime'},
                    allday: {string: 'Allday', type: 'boolean'},
                    partner_ids: {string: 'Attendees', type: 'one2many', relation: 'res.partner'},
                    appointment_type_id: {string: 'Appointment Type', type: 'many2one', relation: 'appointment.type'},
                },
                records: [{
                    id: 1,
                    user_id: session.uid,
                    partner_id: session.uid,
                    name: 'Event 1',
                    start: moment().add(1, 'years').format('YYYY-01-12 10:00:00'),
                    stop: moment().add(1, 'years').format('YYYY-01-12 11:00:00'),
                    allday: false,
                    partner_ids: [1],
                }, {
                    id: 2,
                    user_id: session.uid,
                    partner_id: session.uid,
                    name: 'Event 2',
                    start: moment().add(1, 'years').format('YYYY-01-05 10:00:00'),
                    stop: moment().add(1, 'years').format('YYYY-01-05 11:00:00'),
                    allday: false,
                    partner_ids: [1],
                }, {
                    id: 3,
                    user_id: 214,
                    partner_id: 214,
                    name: 'Event 3',
                    start: moment().add(1, 'years').format('YYYY-01-05 10:00:00'),
                    stop: moment().add(1, 'years').format('YYYY-01-05 11:00:00'),
                    allday: false,
                    partner_ids: [214],
                }
                ],
                check_access_rights: function () {
                    return Promise.resolve(true);
                }
            },
            'appointment.type': {
                fields: {
                    name: {type: 'char'},
                    website_url: {type: 'char'},
                    staff_user_ids: {type: 'many2many', relation: 'res.users'},
                    website_published: {type: 'boolean'},
                    slot_ids: {type: 'one2many', relation: 'appointment.slot'},
                    category: {
                        type: 'selection',
                        selection: [['website', 'Website'], ['custom', 'Custom'], ['work_hours', 'Work Hours']]
                    },
                },
                records: [{
                    id: 1,
                    name: 'Very Interesting Meeting',
                    website_url: '/appointment/1',
                    website_published: true,
                    staff_user_ids: [214],
                    category: 'website',
                }, {
                    id: 2,
                    name: 'Test Appointment',
                    website_url: '/appointment/2',
                    website_published: true,
                    staff_user_ids: [session.uid],
                    category: 'website',
                }],
            },
            'appointment.slot': {
                fields: {
                    appointment_type_id: {type: 'many2one', relation: 'appointment.type'},
                    start_datetime: {string: 'Start', type: 'datetime'},
                    end_datetime: {string: 'End', type: 'datetime'},
                    duration: {string: 'Duration', type: 'float'},
                    slot_type: {
                        string: 'Slot Type',
                        type: 'selection',
                        selection: [['recurring', 'Recurring'], ['unique', 'One Shot']],
                    },
                },
            },
            'hr.employee': {
                fields: {
                    id: {type: 'integer'},
                    name: {type: 'char'},
                    user_id: {type: 'many2one', relation: 'res.users'},
                },
                records: [{
                    id: session.uid,
                    name: 'Actual Employee',
                    user_id: session.uid,
                }, {
                    id: 214,
                    name: 'Denis Ledur',
                    user_id: 214,
                },{
                    id: 216,
                    name: 'Bhailalbhai',
                    user_id: 216,
                }],
            },
            'filter_partner': {
                fields: {
                    id: {string: "ID", type: "integer"},
                    user_id: {string: "user", type: "many2one", relation: 'res.users'},
                    partner_id: {string: "partner", type: "many2one", relation: 'res.partner'},
                    partner_checked: {string: "checked", type: "boolean"},
                },
                records: [
                    {
                        id: 4,
                        user_id: session.uid,
                        partner_id: session.uid,
                        partner_checked: true
                    }, {
                        id: 5,
                        user_id: 214,
                        partner_id: 214,
                        partner_checked: true,
                    }
                ]
            },
        };
    },
    afterReach() {
        session.uid = null;
    }
}, function () {

QUnit.test('Verify appointment links work hours button is displayed', async function (assert) {
    assert.expect(2);

    const calendar = await createCalendarView({
        View: AttendeeCalendarView,
        model: 'calendar.event',
        data: this.data,
        arch: 
        `<calendar class="o_calendar_test"
                    js_class="attendee_calendar"
                    all_day="allday"
                    date_start="start"
                    date_stop="stop"
                    attendee="partner_ids">
            <field name="name"/>
            <field name="partner_ids" write_model="filter_partner" write_field="partner_id"/>
            <field name="partner_id" filters="1" invisible="1"/>
        </calendar>`,
        viewOptions: {
            initialDate: initialDate,
        },
        mockRPC: async function (route, args) {
            if (route === '/microsoft_calendar/sync_data') {
                return Promise.resolve();
            } else if (route === '/web/dataset/call_kw/res.partner/get_attendee_detail') {
                return Promise.resolve([]);
            }
            return this._super.apply(this, arguments);
        },
    });

    assert.containsOnce(calendar, 'button:contains("Share Availabilities")');
    await testUtils.dom.click(calendar.$('#dropdownAppointmentLink'));
    assert.containsOnce(calendar, 'button:contains("Work Hours")');
    calendar.destroy();
});

QUnit.test('create/search work hours appointment type', async function (assert) {
    assert.expect(9);

    patchWithCleanup(browser, {
        navigator: {
            clipboard: {
                writeText: (value) => {
                    assert.strictEqual(
                        value,
                        `http://amazing.odoo.com/appointment/3?filter_staff_user_ids=%5B${session.uid}%5D`
                    );
                }
            }
        }
    });

    const calendar = await createCalendarView({
        View: AttendeeCalendarView,
        model: 'calendar.event',
        data: this.data,
        arch:
        `<calendar class="o_calendar_test"
                    js_class="attendee_calendar"
                    all_day="allday"
                    date_start="start"
                    date_stop="stop"
                    color="partner_id">
            <field name="name"/>
            <field name="partner_ids" write_model="filter_partner" write_field="partner_id"/>
        </calendar>`,
        viewOptions: {
            initialDate: initialDate,
        },
        mockRPC: function (route, args) {
            if (route === "/appointment/appointment_type/search_create_work_hours") {
                assert.step(route);
            } else if (route === '/microsoft_calendar/sync_data') {
                return Promise.resolve();
            } else if (route === '/web/dataset/call_kw/res.partner/get_attendee_detail') {
                return Promise.resolve([]);
            }
            return this._super.apply(this, arguments);
        },
        session: {
            'web.base.url': 'http://amazing.odoo.com',
        },
    }, { positionalClicks: true });

    assert.strictEqual(2, this.data['appointment.type'].records.length)

    await testUtils.dom.click(calendar.$('#dropdownAppointmentLink'));

    await testUtils.dom.click(calendar.$('.o_appointment_search_create_work_hours_appointment'));
    await testUtils.nextTick();

    assert.verifySteps(['/appointment/appointment_type/search_create_work_hours']);
    assert.strictEqual(3, this.data['appointment.type'].records.length,
        "Create a new appointment type")

    await testUtils.dom.click(calendar.$('.o_appointment_change_display'));
    await testUtils.dom.click(calendar.$('#dropdownAppointmentLink'));

    await testUtils.dom.click(calendar.$('.o_appointment_search_create_work_hours_appointment'));
    await testUtils.nextTick();

    assert.verifySteps(['/appointment/appointment_type/search_create_work_hours']);
    assert.strictEqual(3, this.data['appointment.type'].records.length,
        "Does not create a new appointment type");

    calendar.destroy();
});
});
