/** @odoo-module */

import { _t } from '@web/core/l10n/translation';
import { decodeDataBehaviorProps, getVideoUrl } from '@knowledge/js/knowledge_utils';

/**
 * Plugin for OdooEditor. This plugin will allow us to clean/transform the
 * document before saving it in the database.
 */
export class KnowledgePlugin {
    constructor ({ editor }) {
        this.editor = editor;
    }
    /**
     * Remove the highlight decorators from the document and replace the video
     * iframe with a video link before saving. The method aims to solve the
     * following issues:
     * (1) When the user clicks on a link from a table of contents, the editor
     *     will briefly highlight the corresponding title. When the user leaves
     *     the view when a title is highlighted, the highlight decorators can
     *     be saved in the document. To solve that issue, we will remove the
     *     decorators from the document before saving.
     * (2) When saving the document, the sanitizer discards the video iframe
     *     from the document. As a result, people reading the article outside
     *     of the odoo backend will not be able to see and access the video.
     *     To solve that issue, we will replace the iframe with a link before
     *     saving.
     * @param {Element} editable
     */
    cleanForSave(editable) {
        // Remove the highlight decorators:
        for (const header of editable.querySelectorAll('.o_knowledge_header_highlight')) {
            header.classList.remove('o_knowledge_header_highlight');
        }
        // Replace the iframe with a video link:
        for (const anchor of editable.querySelectorAll('.o_knowledge_behavior_type_video')) {
            const props = decodeDataBehaviorProps(anchor.dataset.behaviorProps);
            const a = document.createElement('a');
            a.href = getVideoUrl(props.platform, props.videoId, props.params);
            a.textContent = _t('Open Video');
            a.target = '_blank';
            while (anchor.firstChild) {
                anchor.removeChild(anchor.firstChild);
            }
            anchor.append(a);
        }
    }
}
