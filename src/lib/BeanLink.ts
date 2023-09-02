import moment from 'moment';
import { getContext, setContext } from 'svelte';

export type BeanLinkEvent<T> = {
    name:string,
    value:T,
}

export type BeanLinkEventCreator<T> = {
    name: string,
    event: (value:T) => (BeanLinkEvent<T>)
}

export type BeanLinkEventHandler<T> = (event:BeanLinkEvent<T>) => void;

const eventNames:Map<string, string> = new Map();

export const createEvent = <T>(name:string) => {
    if (eventNames.get(name)) {
        BeanLink.warn('createEvent', 'event name "' + name + '" is being redefined');
    } else {
        eventNames.set(name, name);
    }
    return {
        name,
        event: ((value:T) => ({name, value}))
    };
}

type ContextInitCallback = (beanLink:BeanLink) => void;

export class BeanLink {
    
    private _name:string;
    private _handlers:Map<string, (WeakRef<BeanLinkEventHandler<any>> | BeanLinkEventHandler<any>)[]> = new Map();
    private static featureMap:Map<string, ContextInitCallback[]> = new Map();
    
    private constructor(name:string) {
        this._name = name;
    }

    public static registerFeature(context:string, feature:string, initCallback:ContextInitCallback) {
        let features = BeanLink.featureMap.get(context);
        if (!features) {
            features = [];
            BeanLink.featureMap.set(context, features);
        }
        features.push(initCallback);
        BeanLink.log('register feature', 'context = ' + context + ', feature = '+feature);
    }

    private static initialiseFeatures(context:string, beanLinkInstance:BeanLink) {
        const contextInitCallbacks = BeanLink.featureMap.get(context);
        contextInitCallbacks && contextInitCallbacks.forEach(cb => {
            cb(beanLinkInstance);
        });
    }

    public static getInstance(contextId?:string) {
        let beanLink = getContext('beanLink') as BeanLink;
        let parentBeanLink:BeanLink = beanLink;
        if (!beanLink || (contextId && (contextId !== beanLink.name))) {
            if (contextId) {
                beanLink = new BeanLink(contextId);
                BeanLink.initialiseFeatures(contextId, beanLink);
            } else {
                throw new Error('Assumed beanLink in context where none exists - with no ID provided, none can be created either.');
            }
            parentBeanLink = getContext('beanLink');
            setContext('beanLink', beanLink);
            setContext('parentBeanLink', parentBeanLink);
        } else if (beanLink) {
            parentBeanLink = getContext('parentBeanLink');
        }
        return {
            beanLink,
            parentBeanLink
        }
    }

    get name() {
        return this._name;
    }

    public publish<T>(event:BeanLinkEvent<T>) {
        BeanLink.log('publish start', event.name + ' = ' + JSON.stringify(event.value));
        const handlers = this._handlers.get(event.name);
        const recycledRefs:unknown[] = [];
        if (handlers) {
            handlers.forEach(handler => {
                const handlerRef = (handler instanceof WeakRef) ? handler.deref() : handler;
                if (!handlerRef) {
                    recycledRefs.push(handler);
                } else {
                    handlerRef(event);
                }
            });
            if (recycledRefs.length !== 0) {
                recycledRefs.forEach(ref => {
                    const i = handlers.findIndex(e => e === ref);
                    handlers.splice(i, 1);
                });
                BeanLink.log('cleanup', recycledRefs.length + ' obsolete handler references removed');
            }
        }
        BeanLink.log('publish done', event.name);
    }

    public on<T>(event:BeanLinkEventCreator<T>, handler:BeanLinkEventHandler<T>, weak?:boolean): void;
    public on<T>(event:string, handler:BeanLinkEventHandler<T>, weak?:boolean):void;
    public on<T>(event: string | BeanLinkEventCreator<T>, handler:BeanLinkEventHandler<T>, weak=true):void {
        const eventName = typeof event === 'string' ? event : event.name;
        let handlers = this._handlers.get(eventName);
        if (!handlers) {
            handlers = [];
            this._handlers.set(eventName, handlers);
        }
        //this.log('register', 'name='+eventName+', handler='+handler);
        handlers.push(weak? new WeakRef(handler) : handler);
    }
    
    static log(action:string, message:string) {
        console.log('[beanlink:' + action + '][' + moment().format() + ']:', message);
    }
    static warn(action:string, message:string) {
        console.log('[warning - beanlink:' + action + '][' + moment().format() + ']:', message);
    }
}