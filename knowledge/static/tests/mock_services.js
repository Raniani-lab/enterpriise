/** @odoo-module */

import { patch } from '@web/core/utils/patch';
import { registry } from '@web/core/registry';
import { utils } from '@web/../tests/helpers/mock_env';

const { prepareRegistriesWithCleanup } = utils;

function makeFakeKnowledgeCommandsService() {
    return {
        start() {
            return {
                setCommandsRecordInfo() {},
                getCommandsRecordInfo() { return null; },
            };
        }
    };
}

const serviceRegistry = registry.category('services');
patch(utils, 'knowledge_test_registries', {
    prepareRegistriesWithCleanup() {
        prepareRegistriesWithCleanup(...arguments);
        serviceRegistry.add('knowledgeCommandsService', makeFakeKnowledgeCommandsService());
    },
});
