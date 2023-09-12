/** @odoo-module */
import { reactive, useComponent, useEnv, useSubEnv } from "@odoo/owl";

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
    env.dialogData.dismiss = () => _cancel();

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

// A custom memoize function that doesn't store all results
// First the core/function/memoize tool may yield incorrect result in our case.
// Second, the keys we use usually involve archs themselves that could be heavy in the long run.
export function memoizeOnce(callback) {
    let key, value;
    return function (...args) {
        if (key === args[0]) {
            return value;
        }
        key = args[0];
        value = callback.call(this, ...args);
        return value;
    };
}

export function useSubEnvAndServices(env) {
    const services = env.services;
    const bus = env.bus;
    useSubEnv(env);
    useSubEnv({ services, bus });
}
