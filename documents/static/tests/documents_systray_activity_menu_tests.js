/** @odoo-module **/

import ActivityMenu from '@mail/js/systray/systray_activity_menu';
import { start } from '@mail/../tests/helpers/test_utils';

import session from 'web.session';
import { Items as legacySystrayItems } from 'web.SystrayMenu';
import testUtils from 'web.test_utils';
import { registerCleanup } from '@web/../tests/helpers/cleanup';
import { patchWithCleanup } from '@web/../tests/helpers/utils';

QUnit.module('documents', {}, function () {
    QUnit.module('documents_systray_activity_menu_tests.js');

    QUnit.test('activity menu widget: documents request button', async function (assert) {
        assert.expect(6);

        patchWithCleanup(session, {
            async user_has_group(group) {
                if (group === 'documents.group_documents_user') {
                    assert.step('user_has_group:documents.group_documents_user');
                    return true;
                }
                return this._super(...arguments);
            },
        });
        legacySystrayItems.push(ActivityMenu);
        registerCleanup(() => legacySystrayItems.pop());
        const { wowlEnv: env } = await start({
            hasWebClient: true,
            async mockRPC(route, args) {
                if (args.method === 'systray_get_activities') {
                    return [];
                }
            },
        });
        patchWithCleanup(env.services.action, {
            doAction(action) {
                assert.strictEqual(action, 'documents.action_request_form',
                    "should open the document request form");
            },
        });

        await testUtils.dom.click(document.querySelector('.dropdown-toggle[title="Activities"]'));
        assert.hasClass(document.querySelector('.dropdown-menu'), 'show',
            "dropdown should be expanded");
        assert.verifySteps(['user_has_group:documents.group_documents_user']);
        assert.containsOnce(document.body, '.o_sys_documents_request');
        await testUtils.dom.click(document.querySelector('.o_sys_documents_request'));
        assert.doesNotHaveClass(document.querySelector('.dropdown-menu'), 'show',
            "dropdown should be collapsed");
    });
});
