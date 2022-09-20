/** @odoo-module **/

import { addFields } from '@mail/model/model_core';
import { one } from '@mail/model/model_field';
// ensure that the model definition is loaded before the patch
import '@mail/core_models/messaging';

/**
 * Registers the system singleton 'knowledge' in global messaging singleton.
 */
addFields('Messaging', {
    knowledge: one('Knowledge', {
        default: {},
        readonly: true,
        required: true,
    }),
});
