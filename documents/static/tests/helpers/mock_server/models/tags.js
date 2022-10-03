/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { MockServer } from "@web/../tests/helpers/mock_server";

const FACET_ORDER_COLORS = [
    '#F06050', '#6CC1ED', '#F7CD1F', '#814968', '#30C381', '#D6145F', '#475577', '#F4A460', '#EB7E7F', '#2C8397',
];

patch(MockServer.prototype, 'documents/models/tags', {
    /**
     * Mocks the '_get_tags' method of the model 'documents.tag'.
     */
    _mockDocumentsTag_GetTags(domain, folderId) {
        const facets = this.models['documents.facet'].records;
        const orderedTags = this.models['documents.tag'].records.sort((firstTag, secondTag) => {
            const firstTagFacet = facets.find(facet => facet.id === firstTag.facet_id);
            const secondTagFacet = facets.find(facet => facet.id === secondTag.facet_id);
            return firstTagFacet.sequence === secondTagFacet.sequence
                ? firstTag.sequence - secondTag.sequence
                : firstTagFacet.sequence - secondTagFacet.sequence;
        });
        return orderedTags.map(tag => {
            const [facet] = this.mockSearchRead('documents.facet', [[['id', '=', tag['facet_id']]]], {});
            return {
                display_name: tag.display_name,
                group_hex_color: FACET_ORDER_COLORS[facet.id % FACET_ORDER_COLORS.length],
                group_id: facet.id,
                group_name: facet.name,
                group_sequence: facet.sequence,
                group_tooltip: facet.tooltip,
                id: tag.id,
                sequence: tag.sequence,
            };
        });
    },
});
