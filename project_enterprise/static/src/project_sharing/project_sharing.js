/** @odoo-module **/

import { hasTouch } from '@web/core/browser/feature_detection';
import { useService } from '@web/core/utils/hooks';
import { ProjectSharingWebClient } from '@project/project_sharing/project_sharing';

const { hooks } = owl;

export class ProjectSharingWebClientEnterprise extends ProjectSharingWebClient {
    setup() {
        super.setup();
        useService('enterprise_legacy_service_provider');
        hooks.onMounted(() => {
            this.el.classList.toggle('o_touch_device', hasTouch());
        });
    }
}

ProjectSharingWebClientEnterprise.components = { ...ProjectSharingWebClient.components };
