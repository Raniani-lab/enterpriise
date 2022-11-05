/** @odoo-module **/

import { clear, one, registerPatch } from '@mail/model';

registerPatch({
    name: 'Emoji',
    fields: {
        emojiAsKnowledgeRandom: one('Knowledge', {
            compute() {
                if (!this.messaging || !this.messaging.knowledge) {
                    return clear();
                }
                if (['💩', '💀', '☠️', '🤮', '🖕', '🤢'].includes(this.codepoints)) {
                    return clear();
                }
                return this.messaging.knowledge;
            },
            inverse: 'randomEmojis',
        }),
    },
});
