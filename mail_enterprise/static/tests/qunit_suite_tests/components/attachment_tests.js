/** @odoo-module **/

import { link, replace } from '@mail/model/model_field_command';

import {
    afterNextRender,
    start,
} from '@mail/../tests/helpers/test_utils';

import { patchWithCleanup } from "@web/../tests/helpers/utils";

import { methods } from 'web_mobile.core';

QUnit.module('mail_enterprise', {}, function () {
QUnit.module('components', {}, function () {
QUnit.module('attachment_tests.js');

QUnit.test("'backbutton' event should close attachment viewer", async function (assert) {
    assert.expect(1);

    // simulate the feature is available on the current device
    // component must and will be destroyed before the overrideBackButton is unpatched
    patchWithCleanup(methods, {
        overrideBackButton({ enabled }) {},
    });

    const { createMessageComponent, messaging } = await start({
        env: {
            device: {
                isMobile: true,
            },
        },
    });
    const attachment = messaging.models['Attachment'].create({
        filename: "test.png",
        id: 750,
        mimetype: 'image/png',
        name: "test.png",
    });
    const message = messaging.models['Message'].create({
        attachments: link(attachment),
        author: replace(messaging.currentPartner),
        body: "<p>Test</p>",
        id: 100,
    });
    await createMessageComponent(message);

    await afterNextRender(() => document.querySelector('.o_AttachmentImage').click());
    await afterNextRender(() => {
        // simulate 'backbutton' event triggered by the mobile app
        const backButtonEvent = new Event('backbutton');
        document.dispatchEvent(backButtonEvent);
    });
    assert.containsNone(
        document.body,
        '.o_Dialog',
        "attachment viewer should be closed after receiving the backbutton event"
    );
});

QUnit.test('[technical] attachment viewer should properly override the back button', async function (assert) {
    assert.expect(4);

    // simulate the feature is available on the current device
    // component must and will be destroyed before the overrideBackButton is unpatched
    patchWithCleanup(methods, {
        overrideBackButton({ enabled }) {
            assert.step(`overrideBackButton: ${enabled}`);
        },
    });

    const { createMessageComponent, messaging } = await start({
        env: {
            device: {
                isMobile: true,
            },
        },
    });
    const attachment = messaging.models['Attachment'].create({
        filename: "test.png",
        id: 750,
        mimetype: 'image/png',
        name: "test.png",
    });
    const message = messaging.models['Message'].create({
        attachments: link(attachment),
        author: replace(messaging.currentPartner),
        body: "<p>Test</p>",
        id: 100,
    });
    await createMessageComponent(message);

    await afterNextRender(() => document.querySelector('.o_AttachmentImage').click());
    assert.verifySteps(
        ['overrideBackButton: true'],
        "the overrideBackButton method should be called with true when the attachment viewer is mounted"
    );

    await afterNextRender(() =>
        document.querySelector('.o_AttachmentViewer_headerItemButtonClose').click()
    );
    assert.verifySteps(
        ['overrideBackButton: false'],
        "the overrideBackButton method should be called with false when the attachment viewer is unmounted"
    );
});

});
});
