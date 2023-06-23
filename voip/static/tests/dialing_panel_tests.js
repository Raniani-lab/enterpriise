/* @odoo-module */

import { start } from "@mail/../tests/helpers/test_utils";

import { UserAgent } from "@voip/legacy/user_agent";
import { voipService } from "@voip/voip_service";

import { browser } from "@web/core/browser/browser";
import { registry } from "@web/core/registry";
import mobile from "@web_mobile/js/services/core";
import { ringtoneService } from "@voip/ringtone_service";
import { makeFakeUserService } from "@web/../tests/helpers/mock_services";
import { patchWithCleanup } from "@web/../tests/helpers/utils";
import { dom, nextTick, mock } from "@web/../tests/legacy/helpers/test_utils";
import { userAgentService } from "@voip/user_agent_service";

/**
 * Create a dialing Panel. Params are used to create the underlying web client.
 *
 * @param {Object} params
 * @returns {Object} The value returned by the start method.
 */
async function createDialingPanel(params) {
    const result = await start({
        ...params,
        services: {
            ringtone: ringtoneService,
            user: makeFakeUserService((group) => group === "base.group_user"),
            voip: voipService,
            "voip.user_agent": userAgentService,
        },
    });
    result.env.services.voip.bus.trigger("toggle-softphone-display");
    await nextTick();
    return result;
}

let onaccepted;
let recentList;
let phoneCallDetailsData;

function mockPhoneCallDetails(id) {
    return {
        activity_id: 50 + id,
        activity_model_name: "A model",
        activity_note: false,
        activity_res_id: 200 + id,
        activity_res_model: "res.model",
        activity_summary: false,
        date_deadline: "2018-10-26",
        id,
        mobile: false,
        name: `Record ${id}`,
        note: false,
        partner_email: `partner ${100 + id} @example.com`,
        partner_id: 100 + id,
        partner_avatar_128: "",
        partner_name: `Partner ${100 + id}`,
        phone: "(215)-379-4865",
        state: "open",
    };
}

QUnit.module("dialing panel", {
    beforeEach() {
        onaccepted = undefined;
        recentList = {};
        // generate 3 records
        phoneCallDetailsData = [10, 23, 42].map((id) => {
            return mockPhoneCallDetails(id);
        });
        mock.patch(UserAgent, {
            /**
             * Register callback to avoid the timeout that will accept the call
             * after 3 seconds in demo mode
             *
             * @override
             * @private
             * @param {function} func
             */
            _demoTimeout: (func) => {
                onaccepted = func;
            },
        });

        const mockServerRegistry = registry.category("mock_server");
        if (!mockServerRegistry.contains("get_missed_call_info")) {
            mockServerRegistry.add("get_missed_call_info", () => []);
        }
        if (!mockServerRegistry.contains("hangup_call")) {
            mockServerRegistry.add("hangup_call", () => []);
        }
        if (!mockServerRegistry.contains("get_recent_list")) {
            mockServerRegistry.add("get_recent_list", () => []);
        }
    },
    afterEach() {
        mock.unpatch(UserAgent);
    },
});

QUnit.test("autocall flow", async (assert) => {
    let counterNextActivities = 0;
    const { env } = await createDialingPanel({
        async mockRPC(route, args) {
            if (args.method === "get_pbx_config") {
                return { mode: "demo" };
            }
            if (args.model === "voip.phonecall") {
                const id = args.args[0];
                switch (args.method) {
                    case "get_next_activities_list":
                        counterNextActivities++;
                        return phoneCallDetailsData.filter(
                            (phoneCallDetailData) =>
                                ["done", "cancel"].indexOf(phoneCallDetailData.state) === -1
                        );
                    case "get_recent_list":
                        return phoneCallDetailsData.filter(
                            (phoneCallDetailData) => phoneCallDetailData.state === "open"
                        );
                    case "init_call":
                        assert.step("init_call");
                        return [];
                    case "hangup_call":
                        if (args.kwargs.done) {
                            phoneCallDetailsData.find((d) => d.id === id).state = "done";
                        }
                        assert.step("hangup_call");
                        return;
                    case "create_from_rejected_call":
                        (phoneCallDetailsData.find((d) => d.id === id) || {}).state = "pending";
                        assert.step("rejected_call");
                        return { id: 418 };
                    case "canceled_call":
                        phoneCallDetailsData.find((d) => d.id === id).state = "pending";
                        assert.step("canceled_call");
                        return [];
                    case "remove_from_queue":
                        phoneCallDetailsData.find((d) => d.id === id).state = "cancel";
                        assert.step("remove_from_queue");
                        return [];
                    case "create_from_incoming_call":
                        assert.step("incoming_call");
                        return { id: 200 };
                    case "create_from_incoming_call_accepted":
                        assert.step("incoming_call_accepted");
                        phoneCallDetailsData.push(mockPhoneCallDetails(201));
                        return { id: 201 };
                }
            }
        },
    });
    // make a first call
    assert.containsNone($, ".o_phonecall_details", "Details should not be visible yet");
    assert.containsN($, ".o_dial_next_activities .o_dial_phonecalls .o_dial_phonecall", 3);

    // select first call with autocall
    await dom.click($(".o_dial_call_button"));
    assert.isVisible($(".o_phonecall_details"));
    assert.strictEqual(
        $(".o_phonecall_details .o_dial_phonecall_partner_name strong")[0].innerHTML,
        "Partner 110"
    );

    // start call
    await dom.click($(".o_dial_call_button")[0]);
    assert.isVisible($(".o_phonecall_in_call")[0]);
    assert.containsOnce($, ".o_dial_hangup_button");

    // simulate end of setTimeout in demo mode or answer in prod
    onaccepted();
    // end call
    await dom.click($(".o_dial_hangup_button")[0]);
    assert.containsNone($, ".o_dial_hangup_button");
    assert.strictEqual(
        $(".o_phonecall_details .o_dial_phonecall_partner_name strong")[0].innerHTML,
        "Partner 123"
    );

    // close details
    await dom.click($(".o_phonecall_details_close")[0]);
    assert.containsN($, ".o_dial_next_activities .o_dial_phonecall", 2);

    // hangup before accept call
    // select first call with autocall
    await dom.click($(".o_dial_call_button")[0]);
    assert.strictEqual(
        $(".o_phonecall_details .o_dial_phonecall_partner_name strong")[0].innerHTML,
        "Partner 123"
    );

    // start call
    await dom.click($(".o_dial_call_button")[0]);
    assert.isVisible($(".o_phonecall_in_call"));

    // hangup before accept
    await dom.click($(".o_dial_hangup_button")[0]);
    // we won't accept this call, better clean the current onaccepted
    onaccepted = undefined;
    // close details
    await dom.click($(".o_phonecall_details_close")[0]);

    assert.containsN($, ".o_dial_next_activities .o_dial_phonecall", 2);

    // end list
    // select first call with autocall
    await dom.click($(".o_dial_call_button")[0]);
    assert.strictEqual(
        $(".o_phonecall_details .o_dial_phonecall_partner_name strong")[0].innerHTML,
        "Partner 142"
    );

    // start call
    await dom.click($(".o_dial_call_button")[0]);
    // simulate end of setTimeout in demo mode or answer in prod
    onaccepted();
    // end call
    await dom.click($(".o_dial_hangup_button")[0]);
    assert.strictEqual(
        $(".o_phonecall_details .o_dial_phonecall_partner_name strong")[0].innerHTML,
        "Partner 123"
    );

    // start call
    await dom.click($(".o_dial_call_button")[0]);
    // simulate end of setTimeout in demo mode or answer in prod
    onaccepted();
    // end call
    await dom.click($(".o_dial_hangup_button")[0]);
    assert.containsNone($, ".o_dial_phonecalls .o_dial_phonecall");
    assert.strictEqual(
        counterNextActivities,
        8,
        "avoid to much call to get_next_activities_list, would be great to lower this counter"
    );

    // simulate an incoming call
    env.services.voip.bus.trigger("incomingCall", { detail: { number: "123-456-789" } });
    await nextTick();
    // Accept call
    await dom.click($(".o_dial_accept_button")[0]);
    assert.containsOnce($, ".o_dial_hangup_button");

    // Hangup call
    await dom.click($(".o_dial_hangup_button")[0]);
    assert.containsNone($, ".o_dial_hangup_button");
    assert.containsOnce($, ".o_phonecall_details");

    // simulate an incoming call
    env.services.voip.bus.trigger("incomingCall", { detail: { number: "123-456-789" } });
    await nextTick();
    await dom.click($(".o_dial_reject_button")[0]);
    assert.containsNone($, ".o_dial_hangup_button");
    assert.containsOnce($, ".o_phonecall_details");
    assert.verifySteps([
        "init_call",
        "hangup_call",
        "init_call",
        "canceled_call",
        "init_call",
        "hangup_call",
        "init_call",
        "hangup_call",
        "incoming_call",
        "incoming_call_accepted",
        "hangup_call",
        "incoming_call",
        "rejected_call",
    ]);
});

QUnit.test("Call from Recent tab + keypad", async (assert) => {
    await createDialingPanel({
        async mockRPC(route, args) {
            if (args.method === "get_pbx_config") {
                return { mode: "demo" };
            }
            if (args.model === "voip.phonecall") {
                switch (args.method) {
                    case "create_from_number":
                        assert.step("create_from_number");
                        recentList = [
                            {
                                call_date: "2019-06-06 08:05:47",
                                create_date: "2019-06-06 08:05:47.00235",
                                create_uid: 2,
                                date_deadline: "2019-06-06",
                                direction: "outgoing",
                                id: 0,
                                in_queue: "t",
                                name: "Call to 123456789",
                                user_id: 2,
                                phone: "123456789",
                                start_time: 1559808347,
                                state: "pending",
                                write_date: "2019-06-06 08:05:48.568076",
                                write_uid: 2,
                            },
                        ];
                        return recentList[0];
                    case "create_from_recent":
                        assert.step("create_from_recent");
                        return { id: 202 };
                    case "get_recent_list":
                        return recentList;
                    case "get_next_activities_list":
                        return [];
                    case "init_call":
                        assert.step("init_call");
                        return [];
                    case "hangup_call":
                        assert.step("hangup_call");
                        return;
                }
            }
        },
    });
    // make a first call
    assert.containsNone($, ".o_phonecall_details");
    assert.containsNone($, ".o_dial_recent .o_dial_phonecalls .o_dial_phonecall");

    // select keypad
    await dom.click($(".o_dial_keypad_icon")[0]);
    // click on 1
    await dom.click($(".o_dial_keypad_button")[0]);
    // click on 2
    await dom.click($(".o_dial_keypad_button")[1]);
    // click on 3
    await dom.click($(".o_dial_keypad_button")[2]);
    // click on 4
    await dom.click($(".o_dial_keypad_button")[3]);
    // click on 5
    await dom.click($(".o_dial_keypad_button")[4]);
    // click on 6
    await dom.click($(".o_dial_keypad_button")[5]);
    // click on 7
    await dom.click($(".o_dial_keypad_button")[6]);
    // click on 8
    await dom.click($(".o_dial_keypad_button")[7]);
    // click on 9
    await dom.click($(".o_dial_keypad_button")[8]);
    // call number 123456789
    await dom.click($(".o_dial_call_button")[0]);
    assert.strictEqual(
        $(".o_phonecall_details .o_phonecall_info_name div")[0].innerHTML,
        "Call to 123456789"
    );
    assert.containsOnce($, ".o_dial_hangup_button");

    // simulate end of setTimeout in demo mode or answer in prod
    onaccepted();
    // end call
    await dom.click($(".o_dial_hangup_button")[0]);
    assert.containsNone($, ".o_dial_hangup_button");

    // call number 123456789
    await dom.click($(".o_dial_call_button")[0]);
    onaccepted();
    // end call
    await dom.click($(".o_dial_hangup_button")[0]);
    assert.verifySteps(["create_from_number", "hangup_call", "create_from_recent", "hangup_call"]);
});

QUnit.test("keyboard navigation on dial keypad input", async (assert) => {
    await createDialingPanel({
        async mockRPC(route, args) {
            if (args.method === "get_pbx_config") {
                return { mode: "demo" };
            }
            if (args.model === "voip.phonecall") {
                if (args.method === "create_from_number") {
                    assert.step("create_from_number");
                    recentList = [
                        {
                            call_date: "2019-06-06 08:05:47",
                            create_date: "2019-06-06 08:05:47.00235",
                            create_uid: 2,
                            date_deadline: "2019-06-06",
                            direction: "outgoing",
                            id: 0,
                            in_queue: "t",
                            name: "Call to 987654321",
                            user_id: 2,
                            phone: "987654321",
                            start_time: 1559808347,
                            state: "pending",
                            write_date: "2019-06-06 08:05:48.568076",
                            write_uid: 2,
                        },
                    ];
                    return recentList[0];
                }
                if (args.method === "get_next_activities_list") {
                    return phoneCallDetailsData.filter(
                        (phoneCallDetailData) =>
                            !["done", "cancel"].includes(phoneCallDetailData.state)
                    );
                }
                if (args.method === "hangup_call") {
                    if (args.kwargs.done) {
                        for (const phoneCallDetailData of phoneCallDetailsData) {
                            if (phoneCallDetailData.id === args.args[0]) {
                                phoneCallDetailData.state = "done";
                            }
                        }
                    }
                    assert.step("hangup_call");
                    return [];
                }
            }
        },
    });
    // make a first call
    assert.containsNone($, ".o_phonecall_details");

    // select keypad
    await dom.click($(".o_dial_keypad_icon")[0]);
    // click on 9
    await dom.click($(".o_dial_keypad_button")[8]);
    // click on 8
    await dom.click($(".o_dial_keypad_button")[7]);
    // click on 7
    await dom.click($(".o_dial_keypad_button")[6]);
    // click on 6
    await dom.click($(".o_dial_keypad_button")[5]);
    // click on 5
    await dom.click($(".o_dial_keypad_button")[4]);
    // click on 4
    await dom.click($(".o_dial_keypad_button")[3]);
    // click on 3
    await dom.click($(".o_dial_keypad_button")[2]);
    // click on 2
    await dom.click($(".o_dial_keypad_button")[1]);
    // click on 1
    await dom.click($(".o_dial_keypad_button")[0]);

    // call number 987654321 (validated by pressing enter key)
    $(".o_dial_keypad_input").trigger($.Event("keyup", { keyCode: $.ui.keyCode.ENTER }));
    await nextTick();

    assert.verifySteps(["create_from_number"]);
    assert.strictEqual(
        $(".o_phonecall_details .o_phonecall_info_name")[0].innerText.trim(),
        "Call to 987654321"
    );
    assert.containsOnce($, ".o_dial_hangup_button");

    // simulate end of setTimeout in demo mode or answer in prod
    onaccepted();
    // end call
    await dom.click($(".o_dial_hangup_button")[0]);
    assert.containsNone($, ".o_dial_hangup_button");
    assert.verifySteps(["hangup_call"]);
});

QUnit.test("DialingPanel is closable with the BackButton in the mobile app", async (assert) => {
    mock.patch(mobile.methods, {
        overrideBackButton({ enabled }) {
            assert.step(`overrideBackButton: ${enabled}`);
        },
    });
    const { env } = await createDialingPanel({
        async mockRPC(route, args) {
            if (args.method === "get_pbx_config") {
                return { mode: "demo" };
            }
            if (args.model === "voip.phonecall") {
                if (args.method === "get_next_activities_list") {
                    return [];
                }
            }
        },
    });
    assert.isVisible($(".o_dial"));
    assert.verifySteps(["overrideBackButton: true"]);

    // simulate 'backbutton' events triggered by the app
    await dom.triggerEvent(document, "backbutton");
    assert.isNotVisible($(".o_dial"));
    assert.verifySteps(["overrideBackButton: false"]);

    env.services.voip.bus.trigger("toggle-softphone-display");
    await nextTick();
    await dom.click($(".o_dial_fold")[0]);
    assert.verifySteps(["overrideBackButton: true", "overrideBackButton: false"]);
    await dom.click($(".o_dial_fold")[0]);
    assert.verifySteps(["overrideBackButton: true"], "should be enabled when unfolded");
    await dom.click($(".o_dial_window_close")[0]);
    assert.verifySteps(["overrideBackButton: false"]);

    mock.unpatch(mobile.methods);
});

QUnit.test("Switch Input mode [mobile devices]", async (assert) => {
    // simulate a mobile device environment
    patchWithCleanup(browser, {
        navigator: {
            ...browser.navigator,
            userAgent: "Chrome/0.0.0 (Linux; Android 13; Odoo TestSuite)",
            mediaDevices: {
                async enumerateDevices() {
                    return [
                        {
                            deviceId: "default",
                            kind: "audioinput",
                        },
                        {
                            deviceId: "headset-earpiece-audio-input",
                            kind: "audioinput",
                        },
                        {
                            deviceId: "default-video-input",
                            kind: "videoinput",
                        },
                        {
                            deviceId: "default",
                            kind: "audiooutput",
                        },
                    ];
                },
            },
        },
    });
    await createDialingPanel({
        async mockRPC(route, args) {
            if (args.method === "get_pbx_config") {
                return { mode: "demo" };
            }
            if (args.model === "voip.phonecall") {
                switch (args.method) {
                    case "get_next_activities_list":
                        return phoneCallDetailsData.filter(
                            (phoneCallDetailData) =>
                                ["done", "cancel"].indexOf(phoneCallDetailData.state) === -1
                        );
                    case "init_call":
                        return [];
                }
            }
        },
    });
    // select first call with autocall
    await dom.click($(".o_dial_call_button")[0]);
    // start call
    await dom.click($(".o_dial_call_button")[0]);
    onaccepted();

    // needed to the switch disabled / enabled button
    await dom.click($(".o_dial_headphones_button")[0]);
    assert.isVisible($(".o_select_input_devices"));
    assert.containsN($, ".o_select_input_devices input[name='o_select_input_devices']", 2);
    assert.strictEqual(
        $(".o_select_input_devices input[name='o_select_input_devices']:checked").val(),
        "default"
    );

    // switch to headset-earpiece-audio-input
    await dom.click(
        $(
            ".o_select_input_devices input[name='o_select_input_devices'][value='headset-earpiece-audio-input']"
        )[0]
    );
    await dom.click($(".modal-footer .btn-primary")[0]);
    // the headset-earpiece-audio-input should be selected inside the dialog
    await dom.click($(".o_dial_headphones_button")[0]);
    assert.strictEqual(
        $(".o_select_input_devices input[name='o_select_input_devices']:checked").val(),
        "headset-earpiece-audio-input"
    );
    await dom.click($(".modal-footer .btn-secondary")[0]);
});
