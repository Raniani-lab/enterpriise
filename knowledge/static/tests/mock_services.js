/** @odoo-module */

import { patch } from "@web/core/utils/patch";
import { registry } from '@web/core/registry';
import { utils } from '@web/../tests/helpers/mock_env';

const { prepareRegistriesWithCleanup } = utils;

function makeFakeKnowledgeCommandsService() {
    return {
        start() {
            return {
                setCommandsRecordInfo() {},
                getCommandsRecordInfo() { return null; },
                setPendingBehaviorBlueprint() {},
                popPendingBehaviorBlueprint() {},
            };
        }
    };
}

const serviceRegistry = registry.category('services');
patch(utils, {
    prepareRegistriesWithCleanup() {
        prepareRegistriesWithCleanup(...arguments);
        serviceRegistry.add('knowledgeCommandsService', makeFakeKnowledgeCommandsService());
    },
});
