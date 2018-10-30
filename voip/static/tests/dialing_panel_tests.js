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
 * @returns {Object} {dialingPanel: dialingPanel, parent: parent}
 */
function createDialingPanel(params) {
    var parent = testUtils.createParent(params);
    var dialingPanel = new DialingPanel(parent);
    if (params.debug) {
        dialingPanel.appendTo($('body'));
    } else {
        dialingPanel.appendTo($('#qunit-fixture'));
    }
    dialingPanel._onToggleDisplay();// show panel
    return {dialingPanel: dialingPanel, parent: parent};
}

QUnit.module('voippanel', {
    beforeEach: function () {
        var self = this;
        this.onaccepted = undefined;
        this.services = mailTestUtils.getMailServices();
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
                partner_image_small: "",
                partner_email: "partner" + (100+id) + "@example.com",
                activity_id: 50+id,
                activity_summary: false,
                activity_note: false
             };
        });
        testUtils.patch(UserAgent, { // removes the timeout that will accept the call after 3 seconds in demo mode
            _demoTimeout: function (func) {
                self.onaccepted = func;
            }
        });
    },
    afterEach: function () {
        testUtils.unpatch(UserAgent);
    }
}, function () {
    QUnit.module('DialingPanel');

    QUnit.test('autocall flow', function (assert) {
        assert.expect(25);
        var self = this;
        var counter = 0;
        var res = createDialingPanel({
            services: this.services,
            mockRPC: function (route, args) {
                if (args.method === 'get_pbx_config') {
                    return $.when({
                        mode: "demo"
                    });
                }
                if (args.model === 'voip.phonecall') {
                    if (args.method === 'get_next_activities_list') {
                        counter +=1;
                        var phonecalldetails = _.filter(self.phonecalldetails, function (phonecalldetail) {
                            return ['done', 'cancel'].indexOf(phonecalldetail.state) === -1;
                        });
                        return $.when(phonecalldetails);
                    }
                    var id = args.args[0];
                    if (args.method === 'init_call') {
                        assert.step('init_call');
                        return $.when([]);
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
                        return $.when([]);
                    }
                    if (args.method === 'rejected_call') {
                        _.each(self.phonecalldetails, function (phonecalldetail) {
                            if (phonecalldetail.id === id) {
                                phonecalldetail.state = 'pending';
                            }
                        });
                        assert.step('rejected_call');
                        return $.when([]);
                    }
                    if (args.method === 'remove_from_queue') {
                        _.each(self.phonecalldetails, function (phonecalldetail) {
                            if (phonecalldetail.id === id) {
                                phonecalldetail.state = 'cancel';
                            }
                        });
                        assert.step('remove_from_queue');
                        return $.when([]);
                    }
                }
                return this._super.apply(this, arguments);
            },
        });
        var parent = res.parent;
        var dialingPanel = res.dialingPanel;

        //make a first call
        assert.containsNone(dialingPanel, '.o_phonecall_details', 'Details should not be visible yet');
        assert.containsN(dialingPanel, '.o_dial_phonecalls .o_dial_phonecall', 3,
            "Next activities tab should have 3 phonecalls at the beginning");

        testUtils.dom.click(dialingPanel.$('.o_dial_call_button')); // select first call with autocall
        assert.isVisible(dialingPanel.$('.o_phonecall_details'), 'Details should have been shown');
        assert.strictEqual(dialingPanel.$('.o_phonecall_details .o_dial_phonecall_partner_name span').html(), 'Partner 110',
            'Details should have been shown');

        testUtils.dom.click(dialingPanel.$('.o_dial_call_button')); // start call
        assert.isVisible(dialingPanel.$('.o_phonecall_in_call').first(), 'in call info should be displayed');
        assert.ok(dialingPanel.inCall);

        self.onaccepted(); // simulate end of setTimeout in demo mode or answer in prod
        testUtils.dom.click(dialingPanel.$('.o_dial_hangup_button')); //end call
        assert.notOk(dialingPanel.inCall);
        assert.strictEqual(dialingPanel.$('.o_phonecall_details .o_dial_phonecall_partner_name span').html(), 'Partner 123',
            'Phonecall of second partner should have been displayed');

        testUtils.dom.click(dialingPanel.$('.o_phonecall_details_close')); //close details
        assert.containsN(dialingPanel, '.o_dial_phonecalls .o_dial_phonecall', 2,
            "Next activities tab should have 2 phonecalls after first call");

        //hangup before accept call
        testUtils.dom.click(dialingPanel.$('.o_dial_call_button')); // select first call with autocall
        assert.strictEqual(dialingPanel.$('.o_phonecall_details .o_dial_phonecall_partner_name span').html(), 'Partner 123',
            'Phonecall of second partner should have been displayed');

        testUtils.dom.click(dialingPanel.$('.o_dial_call_button')); // start call
        assert.isVisible(dialingPanel.$('.o_phonecall_in_call').first(), 'in call info should be displayed');

        testUtils.dom.click(dialingPanel.$('.o_dial_hangup_button'));//hangup before accept
        self.onaccepted = undefined; // we won't accept this call, better clean the current onaccepted
        testUtils.dom.click(dialingPanel.$('.o_phonecall_details_close')); //close details
        assert.containsN(dialingPanel, '.o_dial_phonecalls .o_dial_phonecall', 2,
            "No call should have been removed");

        //end list
        testUtils.dom.click(dialingPanel.$('.o_dial_call_button')); // select first call with autocall
        assert.strictEqual(dialingPanel.$('.o_phonecall_details .o_dial_phonecall_partner_name span').html(), 'Partner 142',
            'Phonecall of third partner should have been displayed (second one has already been tried)');

        testUtils.dom.click(dialingPanel.$('.o_dial_call_button')); // start call
        self.onaccepted(); // simulate end of setTimeout in demo mode or answer in prod
        testUtils.dom.click(dialingPanel.$('.o_dial_hangup_button')); //end call
        assert.strictEqual(dialingPanel.$('.o_phonecall_details .o_dial_phonecall_partner_name span').html(), 'Partner 123',
            'Phonecall of second partner should have been displayed');

        testUtils.dom.click(dialingPanel.$('.o_dial_call_button')); // start call
        self.onaccepted(); // simulate end of setTimeout in demo mode or answer in prod
        testUtils.dom.click(dialingPanel.$('.o_dial_hangup_button')); //end call
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
        assert.strictEqual(counter, 8,
            "avoid to much call to get_next_activities_list, would be great to lower this counter");
        parent.destroy();
    });

});
});
