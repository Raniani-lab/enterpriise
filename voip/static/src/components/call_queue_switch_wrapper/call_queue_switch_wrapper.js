/** @odoo-module **/

import { useMessagingContainer } from '@mail/component_hooks/use_messaging_container';

import { registry } from "@web/core/registry";
import { standardFieldProps } from "@web/views/fields/standard_field_props";

const { Component, onWillDestroy, onWillUpdateProps } = owl;
const fieldRegistry = registry.category("fields");

/**
 * This wrapper is intended to provide integration with the models framework. It
 * is responsible for creating a record of the associated view model and
 * deleting it if necessary.
 */
export class CallQueueSwitchWrapper extends Component {

    /**
     * @override
     */
    setup() {
        useMessagingContainer();
        super.setup();
        this.callQueueSwitchView = undefined;
        this.id = this.nextId;
        this._insertFromProps(this.props);
        onWillUpdateProps(nextProps => this._willUpdateProps(nextProps));
        onWillDestroy(() => this._deleteRecord());
    }

    _willUpdateProps(nextProps) {
        this._insertFromProps(nextProps);
    }

    get nextId() {
        return CallQueueSwitchWrapper.nextId++;
    }

    _deleteRecord() {
        if (this.callQueueSwitchView && this.callQueueSwitchView.exists()) {
            this.callQueueSwitchView.delete();
        }
        this.callQueueSwitchView = undefined;
    }

    async _insertFromProps(props) {
        const messaging = await this.env.services.messaging.get();
        if (owl.status(this) === "destroyed") {
            return;
        }
        this.callQueueSwitchView = messaging.models["CallQueueSwitchView"].insert({
            id: this.id,
            isRecordInCallQueue: props.value,
            recordResId: props.record.resId,
            recordResModel: props.record.resModel,
        });
        // insert might trigger a re-render which might destroy the component
        if (owl.status(this) === "destroyed") {
            this._deleteRecord();
            return;
        }
        this.render();
    }

}

Object.assign(CallQueueSwitchWrapper, {
    nextId: 0,
    props: { ...standardFieldProps },
    template: "voip.CallQueueSwitchWrapper",
});

fieldRegistry.add("call_queue_switch", CallQueueSwitchWrapper);
