/** @odoo-module **/

import { beforeEach, start } from '@mail/utils/test_utils';

QUnit.module('voip', {}, function () {
QUnit.module('components', {}, function () {
QUnit.module('activity_tests.js', {
    async beforeEach() {
        await beforeEach(this);
    },
});

QUnit.test('activity: rendering - only with mobile number', async function (assert) {
    assert.expect(5);

    this.data['res.partner'].records.push({
        activity_ids: [12],
        id: 100,
    });
    this.data['mail.activity'].records.push({
        id: 12,
        mobile: '+3212345678',
        res_id: 100,
        res_model: 'res.partner',
    });
    const { createChatterContainerComponent } = await start({ data: this.data });
    await createChatterContainerComponent({
        threadId: 100,
        threadModel: 'res.partner',
    });
    assert.containsOnce(
        document.body,
        '.o_Activity_voipNumberMobile',
        "should have a container for mobile"
    );
    assert.containsOnce(
        document.querySelector('.o_Activity_voipNumberMobile'),
        '.o_Activity_voipCallMobile',
        "should have a link for mobile"
    );
    assert.containsNone(
        document.body,
        'o_Activity_voipNumberPhone',
        "should not have a container for phone"
    );
    assert.containsNone(
        document.body,
        'o_Activity_voipCallPhone',
        "should not have a link for phone"
    );
    assert.strictEqual(
        document.querySelector('.o_Activity_voipNumberMobile').textContent.trim(),
        '+3212345678',
        "should have correct mobile number without a tag"
    );
});

QUnit.test('activity: rendering - only with phone number', async function (assert) {
    assert.expect(5);

    this.data['res.partner'].records.push({
        id: 100,
        activity_ids: [12],
    });
    this.data['mail.activity'].records.push({
        id: 12,
        phone: '+3287654321',
        res_id: 100,
        res_model: 'res.partner',
    });
    const { createChatterContainerComponent } = await start({ data: this.data });
    await createChatterContainerComponent({
        threadId: 100,
        threadModel: 'res.partner',
    });
    assert.containsOnce(
        document.body,
        '.o_Activity_voipNumberPhone'
    );
    assert.containsOnce(
        document.querySelector('.o_Activity_voipNumberPhone'),
        '.o_Activity_voipCallPhone'
    );
    assert.containsNone(
        document.body,
        'o_Activity_voipNumberMobile',
        "should not have a container for mobile"
    );
    assert.containsNone(
        document.body,
        'o_Activity_voipCallMobile',
        "should not have a link for mobile"
    );
    assert.strictEqual(
        document.querySelector('.o_Activity_voipNumberPhone').textContent.trim(),
        '+3287654321',
        "should have correct phone number without a tag"
    );
});

QUnit.test('activity: rendering - with both mobile and phone number', async function (assert) {
    assert.expect(6);

    this.data['res.partner'].records.push({
        activity_ids: [12],
        id: 100,
    });
    this.data['mail.activity'].records.push({
        id: 12,
        mobile: '+3212345678',
        phone: '+3287654321',
        res_id: 100,
        res_model: 'res.partner',
    });
    const { createChatterContainerComponent } = await start({ data: this.data });
    await createChatterContainerComponent({
        threadId: 100,
        threadModel: 'res.partner',
    });
    assert.containsOnce(
        document.body,
        '.o_Activity_voipNumberMobile',
        "should have a container for mobile"
    );
    assert.containsOnce(
        document.querySelector('.o_Activity_voipNumberMobile'),
        '.o_Activity_voipCallMobile',
        "should have a link for mobile"
    );
    assert.strictEqual(
        document.querySelector('.o_Activity_voipNumberMobile').textContent.trim(),
        'Mobile: +3212345678',
        "should have correct mobile number with a tag"
    );

    assert.containsOnce(
        document.body,
        '.o_Activity_voipNumberPhone',
        "should have container for phone"
    );
    assert.containsOnce(
        document.querySelector('.o_Activity_voipNumberPhone'),
        '.o_Activity_voipCallPhone',
        "should have a link for phone"
    );
    assert.strictEqual(
        document.querySelector('.o_Activity_voipNumberPhone').textContent.trim(),
        'Phone: +3287654321',
        "should have correct phone number with a tag"
    );
});

QUnit.test('activity: calling - only with mobile', async function (assert) {
    assert.expect(4);

    this.data['res.partner'].records.push({
        activity_ids: [100],
        id: 100,
    });
    this.data['mail.activity'].records.push({
        id: 100,
        mobile: '+3212345678',
        res_id: 100,
        res_model: 'res.partner',
    });
    const { createChatterContainerComponent } = await start({ data: this.data });
    await createChatterContainerComponent({
        threadId: 100,
        threadModel: 'res.partner',
    });
    const onVoipActivityCallMobile = (ev) => {
        assert.step('voip_call_mobile_triggered');
        assert.strictEqual(
            ev.detail.number,
            '+3212345678',
            "Voip call should be triggered with the mobile number of the activity"
        );
        assert.strictEqual(
            ev.detail.activityId,
            100,
            "Voip call should be triggered with the id of the activity"
        );
    };
    document.addEventListener('voip_activity_call', onVoipActivityCallMobile);

    document.querySelector('.o_Activity_voipCallMobile').click();
    assert.verifySteps(
        ['voip_call_mobile_triggered'],
        "A voip call has to be triggered"
    );
    document.removeEventListener('voip_activity_call', onVoipActivityCallMobile);
});

QUnit.test('activity: calling - only with phone', async function (assert) {
    assert.expect(4);

    this.data['res.partner'].records.push({
        activity_ids: [100],
        id: 100,
    });
    this.data['mail.activity'].records.push({
        id: 100,
        phone: '+3287654321',
        res_id: 100,
        res_model: 'res.partner',
    });
    const { createChatterContainerComponent } = await start({ data: this.data });
    await createChatterContainerComponent({
        threadId: 100,
        threadModel: 'res.partner',
    });
    const onVoipActivityCallPhone = (ev) => {
        assert.step('voip_call_phone_triggered');
        assert.strictEqual(
            ev.detail.number,
            '+3287654321',
            "Voip call should be triggered with the phone number of the activity"
        );
        assert.strictEqual(
            ev.detail.activityId,
            100,
            "Voip call should be triggered with the id of the activity"
        );
    };
    document.addEventListener('voip_activity_call', onVoipActivityCallPhone);

    document.querySelector('.o_Activity_voipCallPhone').click();
    assert.verifySteps(
        ['voip_call_phone_triggered'],
        "A voip call has to be triggered"
    );
    document.removeEventListener('voip_activity_call', onVoipActivityCallPhone);
});

});
});
