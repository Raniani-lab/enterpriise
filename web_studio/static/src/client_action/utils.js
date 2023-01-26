/** @odoo-module */
import { reactive, useComponent, useEnv } from "@odoo/owl";

export function useDialogConfirmation({ confirm, cancel, before, close }) {
    before = before || (() => {});
    confirm = confirm || (() => {});
    cancel = cancel || (() => {});
    if (!close) {
        const component = useComponent();
        close = () => component.props.close();
    }

    let isProtected = false;
    async function canExecute() {
        if (isProtected) {
            return false;
        }
        isProtected = true;
        await before();
        return true;
    }

    async function execute(cb, ...args) {
        let succeeded = false;
        try {
            succeeded = await cb(...args);
        } catch (e) {
            close();
            throw e;
        }
        if (succeeded === undefined || succeeded) {
            return close();
        }
        isProtected = false;
    }

    async function _confirm(...args) {
        if (!(await canExecute())) {
            return;
        }
        return execute(confirm, ...args);
    }

    async function _cancel(...args) {
        if (!(await canExecute())) {
            return;
        }
        return execute(cancel, ...args);
    }

    const env = useEnv();
    env.dialogData.close = () => _cancel();

    return { confirm: _confirm, cancel: _cancel };
}

export class Reactive {
    constructor() {
        const raw = this;
        // A function not bound to this returning the original not reactive object
        // This is usefull to be able to read stuff without subscribing the caller
        // eg: when reading internals just for checking
        this.raw = () => {
            return raw;
        };
        return reactive(this);
    }
}
