odoo.define('voip.tests_panel', function (require) {
"use strict";

var mailTestUtils = require('mail.testUtils');
var DialingPanel = require('voip.dialingPanel').DialingPanel;
var UserAgent = require('voip.user_agent');
var testUtils = require('web.test_utils');

/**
 * Create a dialing Panel and attach it to a parent. Uses params to create the parent
 * and to define if mode debug is set
 * @param {Object} params
 * @returns {Promise<Object>} {dialingPanel: dialingPanel, parent: parent}
 */
async function createDialingPanel(params) {
    var parent = testUtils.createParent(params);
    var dialingPanel = new DialingPanel(parent);
    var container = params.debug ? $('body') : $('#qunit-fixture');
    await dialingPanel.appendTo(container)
        dialingPanel._onToggleDisplay();// show panel
    dialingPanel._refreshPhonecallsStatus();
    await testUtils.nextTick();
    return {
        dialingPanel,
        parent
    };
}

QUnit.module('voippanel', {}, function (){
QUnit.module('DialingPanel',{
    beforeEach: function () {
        var self = this;
        this.onaccepted = undefined;
        this.services = mailTestUtils.getMailServices();
        this.recent_list = {}
        // generate 3 records
        this.phonecalldetails = _.map([10,23,42], function (id) {
            return {
                id: id,
                name: "Record "+id,
                state: "open",
                date_deadline: "2018-10-26",
                phone: "(215)-379-4865",
                mobile: false,
                note: false,
                partner_id: 100+id,
                activity_res_id: 200+id,
                activity_res_model: "res.model",
                activity_model_name: "A model",
                partner_name: "Partner "+ (100+id),
                partner_image_64: "",
                partner_email: "partner" + (100+id) + "@example.com",
                activity_id: 50+id,
                activity_summary: false,
                activity_note: false
             };
        });
        testUtils.mock.patch(UserAgent, {
            /**
             * Override to catch the "NotAllowedError" that may be triggered if
             * no DOM manipulation is detected before playing the media (chrome
             * policy to prevent from autoplaying)
             */
            makeCall: function () {
                this._super.apply(this, arguments);
                this.playRingbacktonePromise = this.playRingbacktonePromise.catch(function (e) {
                    if (e instanceof DOMException && e.name === 'NotAllowedError') {
                        return;
                    }
                    throw e;
                });
            },
            /**
             * Register callback to avoid the timeout that will accept the call
             * after 3 seconds in demo mode
             *
             * @param {function} func
             */
            _demoTimeout: function (func) {
                self.onaccepted = func;
            }
        });
    },
    afterEach: function () {
        testUtils.mock.unpatch(UserAgent);
    }
}, function () {
    QUnit.test('autocall flow', async function (assert) {
        assert.expect(25);
        var self = this;
        var counter = 0;
        var {dialingPanel,parent} = await createDialingPanel({
            services: this.services,
            mockRPC: function (route, args) {
                if (args.method === 'get_pbx_config') {
                    return Promise.resolve({
                        mode: "demo"
                    });
                }
                if (args.model === 'voip.phonecall') {
                    if (args.method === 'get_next_activities_list') {
                        counter +=1;
                        var phonecalldetails = _.filter(self.phonecalldetails, function (phonecalldetail) {
                            return ['done', 'cancel'].indexOf(phonecalldetail.state) === -1;
                        });
                        return Promise.resolve(phonecalldetails);
                    }
                    var id = args.args[0];
                    if (args.method === 'init_call') {
                        assert.step('init_call');
                        return Promise.resolve([]);
                    }
                    if (args.method === 'hangup_call') {
                        var done = args.kwargs.done;
                        if (done) {
                            _.each(self.phonecalldetails, function (phonecalldetail) {
                                if (phonecalldetail.id === id) {
                                    phonecalldetail.state = 'done';
                                }
                            });
                        }
                        assert.step('hangup_call');
                        return Promise.resolve([]);
                    }
                    if (args.method === 'rejected_call') {
                        _.each(self.phonecalldetails, function (phonecalldetail) {
                            if (phonecalldetail.id === id) {
                                phonecalldetail.state = 'pending';
                            }
                        });
                        assert.step('rejected_call');
                        return Promise.resolve([]);
                    }
                    if (args.method === 'remove_from_queue') {
                        _.each(self.phonecalldetails, function (phonecalldetail) {
                            if (phonecalldetail.id === id) {
                                phonecalldetail.state = 'cancel';
                            }
                        });
                        assert.step('remove_from_queue');
                        return Promise.resolve([]);
                    }
                }
                return this._super.apply(this, arguments);
            },
        });

        //make a first call
        assert.containsNone(dialingPanel, '.o_phonecall_details', 'Details should not be visible yet');
        assert.containsN(dialingPanel, '.o_dial_next_activities .o_dial_phonecalls .o_dial_phonecall', 3,
            "Next activities tab should have 3 phonecalls at the beginning");
        await testUtils.dom.click(dialingPanel.$('.o_dial_call_button')); // select first call with autocall
        assert.isVisible(dialingPanel.$('.o_phonecall_details'), 'Details should have been shown');
        assert.strictEqual(dialingPanel.$('.o_phonecall_details .o_dial_phonecall_partner_name span').html(), 'Partner 110',
            'Details should have been shown');

        await testUtils.dom.click(dialingPanel.$('.o_dial_call_button')); // start call
        assert.isVisible(dialingPanel.$('.o_phonecall_in_call').first(), 'in call info should be displayed');
        assert.ok(dialingPanel.inCall);

        self.onaccepted(); // simulate end of setTimeout in demo mode or answer in prod
        await testUtils.dom.click(dialingPanel.$('.o_dial_hangup_button')); //end call
        assert.notOk(dialingPanel.inCall);
        assert.strictEqual(dialingPanel.$('.o_phonecall_details .o_dial_phonecall_partner_name span').html(), 'Partner 123',
            'Phonecall of second partner should have been displayed');

        await testUtils.dom.click(dialingPanel.$('.o_phonecall_details_close')); //close details
        assert.containsN(dialingPanel, '.o_dial_next_activities .o_dial_phonecall', 2,
            "Next activities tab should have 2 phonecalls after first call");

        //hangup before accept call
        await testUtils.dom.click(dialingPanel.$('.o_dial_call_button')); // select first call with autocall
        assert.strictEqual(dialingPanel.$('.o_phonecall_details .o_dial_phonecall_partner_name span').html(), 'Partner 123',
            'Phonecall of second partner should have been displayed');

        await testUtils.dom.click(dialingPanel.$('.o_dial_call_button')); // start call
        assert.isVisible(dialingPanel.$('.o_phonecall_in_call').first(), 'in call info should be displayed');

        await testUtils.dom.click(dialingPanel.$('.o_dial_hangup_button'));//hangup before accept
        self.onaccepted = undefined; // we won't accept this call, better clean the current onaccepted
        await testUtils.dom.click(dialingPanel.$('.o_phonecall_details_close')); //close details

        assert.containsN(dialingPanel, '.o_dial_next_activities .o_dial_phonecall', 2,
            "No call should have been removed");

        //end list
        await testUtils.dom.click(dialingPanel.$('.o_dial_call_button')); // select first call with autocall
        assert.strictEqual(dialingPanel.$('.o_phonecall_details .o_dial_phonecall_partner_name span').html(), 'Partner 142',
            'Phonecall of third partner should have been displayed (second one has already been tried)');

        await testUtils.dom.click(dialingPanel.$('.o_dial_call_button')); // start call
        self.onaccepted(); // simulate end of setTimeout in demo mode or answer in prod
        await testUtils.dom.click(dialingPanel.$('.o_dial_hangup_button')); //end call
        assert.strictEqual(dialingPanel.$('.o_phonecall_details .o_dial_phonecall_partner_name span').html(), 'Partner 123',
            'Phonecall of second partner should have been displayed');

        await testUtils.dom.click(dialingPanel.$('.o_dial_call_button')); // start call
        self.onaccepted(); // simulate end of setTimeout in demo mode or answer in prod
        await testUtils.dom.click(dialingPanel.$('.o_dial_hangup_button')); //end call
        assert.containsNone(dialingPanel, '.o_dial_phonecalls .o_dial_phonecall',
            "The list should be empty");
        assert.verifySteps([
            'init_call',
            'hangup_call',
            'init_call',
            'rejected_call',
            'init_call',
            'hangup_call',
            'init_call',
            'hangup_call'
        ]);
        assert.strictEqual(counter, 9,
            "avoid to much call to get_next_activities_list, would be great to lower this counter");
        parent.destroy();
    });

    QUnit.test('Call from Recent tab + keypad', async function (assert) {
        assert.expect(10);
        var self = this;
        var {dialingPanel,parent} = await createDialingPanel({
            services: this.services,
            mockRPC: function (route, args) {
                if (args.method === 'get_pbx_config') {
                    return Promise.resolve({
                        mode: "demo"
                    });
                }
                if (args.model === 'voip.phonecall') {
                    if (args.method === 'create_from_number') {
                        assert.step('create_from_number');
                        self.recent_list = [{
                            id: 0,
                            name: "Call to 123456789",
                            date_deadline:"2019-06-06",
                            call_date:"2019-06-06 08:05:47",
                            user_id: 2,
                            phone: "123456789",
                            in_queue: "t",
                            start_time: 1559808347,
                            state: "pending",
                            phonecall_type: "outgoing",
                            create_uid: 2,
                            create_date: "2019-06-06 08:05:47.00235",
                            write_uid: 2,
                            write_date:"2019-06-06 08:05:48.568076"
                        }];
                        return Promise.resolve(self.recent_list[0])
                    }

                    if (args.method === 'create_from_recent') {
                        assert.step('create_from_recent');
                        return Promise.resolve();
                    }

                    if (args.method === 'get_recent_list'){
                        return Promise.resolve(self.recent_list)
                    }
                    if (args.method === 'get_next_activities_list') {
                        var phonecalldetails = _.filter(self.phonecalldetails, function (phonecalldetail) {
                            return ['done', 'cancel'].indexOf(phonecalldetail.state) === -1;
                        });
                        return Promise.resolve(phonecalldetails);
                    }

                    var id = args.args[0];
                    if (args.method === 'init_call') {
                        assert.step('init_call');
                        return Promise.resolve([]);
                    }
                    if (args.method === 'hangup_call') {
                        var done = args.kwargs.done;
                        if (done) {
                            _.each(self.phonecalldetails, function (phonecalldetail) {
                                if (phonecalldetail.id === id) {
                                    phonecalldetail.state = 'done';
                                }
                            });
                        }
                        assert.step('hangup_call');
                        return Promise.resolve([]);
                    }
                }
                return this._super.apply(this, arguments);
            },
        });

        //make a first call
        assert.containsNone(dialingPanel, '.o_phonecall_details', 'Details should not be visible yet');
        assert.containsN(dialingPanel, '.o_dial_recent .o_dial_phonecalls .o_dial_phonecall', 0,
            "Recent tab should have 0 phonecall at the beginning");
        await testUtils.dom.click(dialingPanel.$('.o_dial_keypad_icon')); // select keypad
        await testUtils.dom.click(dialingPanel.$('.o_dial_keypad_button')[0]); //click on 1
        await testUtils.dom.click(dialingPanel.$('.o_dial_keypad_button')[1]); //click on 2
        await testUtils.dom.click(dialingPanel.$('.o_dial_keypad_button')[2]); //click on 3
        await testUtils.dom.click(dialingPanel.$('.o_dial_keypad_button')[3]); //click on 4
        await testUtils.dom.click(dialingPanel.$('.o_dial_keypad_button')[4]); //click on 5
        await testUtils.dom.click(dialingPanel.$('.o_dial_keypad_button')[5]); //click on 6
        await testUtils.dom.click(dialingPanel.$('.o_dial_keypad_button')[6]); //click on 7
        await testUtils.dom.click(dialingPanel.$('.o_dial_keypad_button')[7]); //click on 8
        await testUtils.dom.click(dialingPanel.$('.o_dial_keypad_button')[8]); //click on 9
        await testUtils.dom.click(dialingPanel.$('.o_dial_call_button')); // call number 123456789
        assert.strictEqual(dialingPanel.$('.o_phonecall_details .o_dial_phonecall_partner_name span').html(), 'Call to 123456789',
            'Details should have been shown');
        assert.ok(dialingPanel.inCall);
        self.onaccepted(); // simulate end of setTimeout in demo mode or answer in prod
        await testUtils.dom.click(dialingPanel.$('.o_dial_hangup_button')); //end call
        assert.notOk(dialingPanel.inCall);
        await testUtils.dom.click(dialingPanel.$('.o_dial_call_button')); // call number 123456789
        self.onaccepted();
        await testUtils.dom.click(dialingPanel.$('.o_dial_hangup_button')); //end call
        assert.verifySteps([
        'create_from_number',
        'hangup_call',
        'create_from_recent',
        'hangup_call',
        ]);
        parent.destroy();

    });
});
});
});
